---
layout: post
title: "FetcherJob - Nutch2"
category: Nutch
tags: [hadoop, nutch, map-reduce, fetch, nutch2]
---
FetcherJob主要负责读取GeneratorJob中生成的抓取列表，并按照一定规则对列表中的数据进行抓取

## 任务配置 {#job-configuration}
下面是FetcherJob中的run方法

{% highlight java %}
...
String batchId = (String)args.get(Nutch.ARG_BATCH);
...
if (batchId == null) {
  batchId = Nutch.ALL_BATCH_ID_STR;
}
getConf().set(GeneratorJob.BATCH_ID, batchId);   
// 获取需要进行抓取的batchId，如果为空，则全部URL加入待抓取列表，但并不意味着这些URL都能被抓取，
// 还要经过其他条件的筛选，例如以前是否抓取过等
// 部分代码省略，设置抓取时间限制等
currentJob = new NutchJob(getConf(), "fetch");
Collection<WebPage.Field> fields = getFields(currentJob);
// 设置Mapper函数和Reducer函数，并按照Host或Domain将URL分配到不同的Reducer中
StorageUtils.initMapperJob(currentJob, fields, IntWritable.class,
        FetchEntry.class, FetcherMapper.class, FetchEntryPartitioner.class, false);
StorageUtils.initReducerJob(currentJob, FetcherReducer.class);
if (numTasks == null || numTasks < 1) {
   // 默认情况下使用map任务数作为reduce任务数
   currentJob.setNumReduceTasks(currentJob.getConfiguration().getInt("mapred.map.tasks",
          currentJob.getNumReduceTasks()));
} else {
   currentJob.setNumReduceTasks(numTasks);
}
currentJob.waitForCompletion(true);
ToolUtil.recordJobStatus(null, currentJob, results);
return results;
{% endhighlight %}

## Mapper

过滤已抓取过的URL，和非指定batchId的URL

{% highlight java %}
@Override
protected void map(String key, WebPage page, Context context)
    throws IOException, InterruptedException {
  Utf8 mark = Mark.GENERATE_MARK.checkMark(page);
  // 检查WebPage中batchId是否与指定的batchId的一致，或者指定抓取所有WebPage
  if (!NutchJob.shouldProcess(mark, batchId)) {
    if (LOG.isDebugEnabled()) {
      LOG.debug("Skipping " + TableUtil.unreverseUrl(key) + "; different batch id (" + mark + ")");
    }
    return;
  }
  // 检查WebPage是否被抓取过，或者是否设置为重新抓取
  if (shouldContinue && Mark.FETCH_MARK.checkMark(page) != null) {
    if (LOG.isDebugEnabled()) {
      LOG.debug("Skipping " + TableUtil.unreverseUrl(key) + "; already fetched");
    }
    return;
  }
  context.write(new IntWritable(random.nextInt(65536)), new FetchEntry(context
      .getConfiguration(), key, page));
}
{% endhighlight %}

## Reducer

FetcherReducer和一般的Reducer实现不同，它重写了org.apache.hadoop.mapreduce.Reducer的run方法，下面是默认的run实现

{% highlight java %}
public void run(Context context) throws IOException, InterruptedException {
    setup(context);
    // 根据context对象获取下一个被分配到该Reducer节点的key，并进行迭代
    while (context.nextKey()) {
      // 一般Reducer只需要重写该方法
      reduce(context.getCurrentKey(), context.getValues(), context);
    }
    cleanup(context);
} 
{% endhighlight %}

一般的Reducer实现只需要重写reduce方法即可，但如果需要特殊的需求，该默认实现无法满足时，则我们必须自己实现Reducer的run方法

{% highlight java %}
@Override
public void run(Context context) throws IOException, InterruptedException {
    Configuration conf = context.getConfiguration();
    // 新建一个fetch队列，而FetchItemQueues是一个以Host，Domain为key，该Host/Domain下URL的队列为Value的Map
    this.fetchQueues = new FetchItemQueues(conf);
    int threadCount = conf.getInt("fetcher.threads.fetch", 10);
    ....
    // 创建一个抓取队列的生产者线程，队列添加最大限制为(消费者线程数)*(每个线程最大处理URL数)
    int maxFeedPerThread = conf.getInt("fetcher.queue.depth.multiplier", 50);
    feeder = new QueueFeeder(context, fetchQueues, threadCount * maxFeedPerThread);
    feeder.start();
    // 创建抓取队列的消费者线程，这些线程负责具体URL的抓取
    for (int i = 0; i < threadCount; i++) {       // spawn threads
       FetcherThread ft = new FetcherThread(context, i);
       fetcherThreads.add(ft);
       ft.start();
    }
    .....
    // 统计信息
}
{% endhighlight %}

## QueueFeeder

{% highlight java %}
public QueueFeeder(Context context,
        FetchItemQueues queues, int size)
    throws IOException, InterruptedException {
   this.context = context;
   this.queues = queues;
   this.size = size;
   this.setDaemon(true);
   this.setName("QueueFeeder");
   // 获取Reducer中第一个Key与Value迭代器
   hasMore = context.nextKey();
   if (hasMore) {
      currentIter = context.getValues().iterator();
   }
   // the value of the time limit is either -1 or the time where it should finish
   timelimit = context.getConfiguration().getLong("fetcher.timelimit", -1);
 } 
{% endhighlight %}

`QueueFeeder`的`run`方法

{% highlight java %}
int cnt = 0;
int timelimitcount = 0;
try {
    while (hasMore) {
    // 如果当前时间已经超过规定的抓取时限，直接忽略这些URL，并获取下一个Map/Reduce键值对
    if (System.currentTimeMillis() >= timelimit && timelimit != -1) {
       // enough .. lets' simply
       // read all the entries from the input without processing them
       while (currentIter.hasNext()) {
          currentIter.next();
          timelimitcount++;
       }
       hasMore = context.nextKey();
       if (hasMore) {
           currentIter = context.getValues().iterator();
       }
       continue;
   }
   // size为Reducer总处理能力，queues.getTotalSize()为队列中的记录条数
   int feed = size - queues.getTotalSize();
   if (feed <= 0) {
       // queues are full - spin-wait until they have some free space
       try {
           Thread.sleep(1000);
       } catch (final Exception e) {};
           continue;
       }
       if (LOG.isDebugEnabled()) {
          LOG.debug("-feeding " + feed + " input urls ...");
       }
       // 当Queue不满，并且当前key下有URL时，将URL添加到队列中
       while (feed > 0 && currentIter.hasNext()) {
          FetchEntry entry = currentIter.next();
          final String url =
          TableUtil.unreverseUrl(entry.getKey());
          queues.addFetchItem(url, entry.getWebPage());
          feed--;
          cnt++;
       }
       // 当Queue被填充满后，继续阻塞等待1秒
       if (currentIter.hasNext()) {
          continue; // finish items in current list before reading next key
       }
       // 当Queue未满，而当前key下已无URL时，迭代下一个KEY
       hasMore = context.nextKey();
       if (hasMore) {
          currentIter = context.getValues().iterator();
       }
    }
 } catch (Exception e) {
    LOG.error("QueueFeeder error reading input, record " + cnt, e);
    return;
 }
 LOG.info("QueueFeeder finished: total " + cnt + " records. Hit by time limit :"
         + timelimitcount);
 context.getCounter("FetcherStatus","HitByTimeLimit-QueueFeeder").increment(timelimitcount);
}
{% endhighlight %}

## FetcherThread

{% highlight java %}
@Override
public void run() {
   activeThreads.incrementAndGet(); // count threads
 
   FetchItem fit = null;
   try {
      while (true) {
         fit = fetchQueues.getFetchItem();
         // 从队列中获取一个URL, 如果没有获取到，且feeder线程已经结束而且队列中没有记录，则说明FetcherThread任务已完成，线程返回
         // 如果feeder还在工作，或者queue中还有记录，则等待500ms，继续从队列中获取URL
         if (fit == null) {
            if (feeder.isAlive() || fetchQueues.getTotalSize() > 0) {
               if (LOG.isDebugEnabled()) {
                  LOG.debug(getName() + " fetchQueues.getFetchItem() was null, spin-waiting ...");
               }
               // spin-wait.
               spinWaiting.incrementAndGet();
               try {
                  Thread.sleep(500);
               } catch (final Exception e) {}
               spinWaiting.decrementAndGet();
               continue;
            } else {
               // all done, finish this thread
               return;
            }
         }
         lastRequestStart.set(System.currentTimeMillis());
         // 如果WebPage中重定向URL存在，则直接抓取重定向URL，否则，抓取WebPage的URL
         if (!fit.page.isReadable(WebPage.Field.REPR_URL.getIndex())) {
            reprUrl = fit.url;
         } else {
            reprUrl = TableUtil.toString(fit.page.getReprUrl());
          }
          try {
            LOG.info("fetching " + fit.url);
            // fetch the page
            final Protocol protocol = this.protocolFactory.getProtocol(fit.url);
            final RobotRules rules = protocol.getRobotRules(fit.url, fit.page);
            if (!rules.isAllowed(fit.u)) {  // 检测robots协议，如果该URL不被允许抓取，则不对该URL进行抓取，并进行状态标示。
              // unblock
              fetchQueues.finishFetchItem(fit, true);
              if (LOG.isDebugEnabled()) {
                LOG.debug("Denied by robots.txt: " + fit.url);
              }
              output(fit, null, ProtocolStatusUtils.STATUS_ROBOTS_DENIED,
                  CrawlStatus.STATUS_GONE);
              continue;
            }
            if (rules.getCrawlDelay() > 0) {
              if (rules.getCrawlDelay() > maxCrawlDelay) {
                // unblock
                fetchQueues.finishFetchItem(fit, true);
                LOG.debug("Crawl-Delay for " + fit.url + " too long (" + rules.getCrawlDelay() + "), skipping");
                output(fit, null, ProtocolStatusUtils.STATUS_ROBOTS_DENIED, CrawlStatus.STATUS_GONE);
                continue;
              } else {
                final FetchItemQueue fiq = fetchQueues.getFetchItemQueue(fit.queueID);
                fiq.crawlDelay = rules.getCrawlDelay();
              }
            }
            // 通过URL的协议进行抓取，并获取内容
            final ProtocolOutput output = protocol.getProtocolOutput(fit.url, fit.page);
            final ProtocolStatus status = output.getStatus();
            final Content content = output.getContent();
            // unblock queue
            fetchQueues.finishFetchItem(fit);
            context.getCounter("FetcherStatus", ProtocolStatusUtils.getName(status.getCode())).increment(1);
            int length = 0;
            if (content!=null && content.getContent()!=null) length= content.getContent().length;
            updateStatus(length);
            switch(status.getCode()) {
               ...
               // 根据访问URL访回的状态值，进行不同的处理
            }
         } catch (final Throwable t) {                 // unexpected exception
            // unblock
            fetchQueues.finishFetchItem(fit);
            LOG.error("Unexpected error for " + fit.url, t);
            output(fit, null, ProtocolStatusUtils.STATUS_FAILED,
                CrawlStatus.STATUS_RETRY);
         }
      }
   } catch (final Throwable e) {
      LOG.error("fetcher throwable caught", e);
   } finally {
      if (fit != null) fetchQueues.finishFetchItem(fit);
         // 线程结束后，更新消费者线程计数器
         activeThreads.decrementAndGet(); // count threads
         LOG.info("-finishing thread " + getName() + ", activeThreads=" + activeThreads);
      }
   } 
}
{% endhighlight %}