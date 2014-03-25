---
layout: post
title: "Fetcher - Nutch"
category: Nutch
tags: [hadoop, nutch, fetch, map-reduce]
---
## 1. Fetcher模块的简单介绍 {#introdution}

Fetcher这个模块在Nutch中有单独一个包在实现，在`org.apache.nutch.fetcher`，其中有`Fetcher.java`, `FetcherOutput` 和`FetcherOutputFormat`来组成，看上去很简单，但其中使用到了多线程，多线程的生产者与消费者模型，MapReduce的多路径输出等方法。

下面我们来看一下Fetcher的注释，从中我们可以得到很多有用的信息。

首先，这是一种基于队列的fetcher方法，它使用了一种经典的线程模型，生产者(a-QueueFeeder)与消费者(many-FetcherThread)模型，注意，这里有多个消费者。生产者从Generate产生的fetchlists中分类得到一批`FetchItemQueue`，每一个`FetchItmeQueue`都是由一类相同host的`FetchItem`组成，这些`FetchItem`是用来描述被抓取的对象。当一个`FetchItem`从`FetchItemQueue`中取出后，`QueueFeeder`这个生产者会不断的向队列中加入新的`FetchItem`，直到这个队列满了为止或者已经没有fetchlist可读取，当队列中的所有`FetchItem`都被抓取完成后，所有抓取线程都会退出运行。每一个`FetchItemQueue`都有一套自己的抓取策略，如最大的并行抓取个数，两次抓取的间隔等，如果当`FetcherThread`向队列申请一个`FetchItem`时，`FetchItemQueue`发现当前的`FetchItem`没有满足抓取策略，那这里它就会返回null，表达当前`FetchItem`还没有准备好被抓取。如果这些所有`FetchItem`都没有准备好被抓取，那这时`FetchThread`就会进入等待状态，直到条件满足被促发或者是等待超时，它会认为任务已经被挂起，这时`FetchThread`会自动退出。

## 2. FetcherOutputFormat的介绍 {#fetcher-output-format}

这个类是用来把`FetcherOutput`对象切分到不同的Map文件中的，也就是说它会根据对象的类型来判断输出到哪一个文件中，这里用到了一个多文件的输出。

`FetcherOutputFormat`继承自MapReduce框架的`OutputFormat`模板，其输出的&lt;key,value&gt;类型为`&lt;Text, NutchWritable&gt;`。

这里的`OutputFormat`定义了Map-Reduce任务的输出描述，Map-Reduce框架依赖任务的`OutputFormat`来做如下二件事情，一是用来验证输出源的可用性，如是否已经建立了相应的目录，数据库是否已经连上;另一件事是提供`RecordWriter`抽象来对数据进行写出到特定的数据源，一般输出文件定义在`FileSystem`里面。
`FetcherOutputFormat`主要是实现了`getRecordWriter`这个方法，用于得到相应的数据写出对象，我们来分析一下其源代码：

{% highlight java %}
public RecordWriter<Text, NutchWritable> getRecordWriter(final FileSystem fs, final JobConf job, final String name, final Progressable progress) throws IOException {
    // 定义输出目录
    Path out = FileOutputFormat.getOutputPath(job);
    // 定义抓取的输出目录
    final Path fetch = new Path(new Path(out, CrawlDatum.FETCH_DIR_NAME), name);
   
    // 定义抓取内容的输出目录
    final Path content = new Path(new Path(out, Content.DIR_NAME), name);
   
    // 定义数据压缩格式
    final CompressionType compType = SequenceFileOutputFormat.getOutputCompressionType(job);
   
    // 定义抓取的输出抽象类
    final MapFile.Writer fetchOut = new MapFile.Writer(job, fs, fetch.toString(), Text.class, CrawlDatum.class, compType, progress);
    // 这里使用了inner class来定义相应的RecordWriter
    return new RecordWriter<Text, NutchWritable>(){
        private MapFile.Writer contentOut;
        private RecordWriter<Text, Parse> parseOut;
   
   
        {
            // 这里看如果Fetcher定义了输出内容，就生成相应的Content输出抽象
            if (Fetcher.isStoringContent(job)) {
                 contentOut = new MapFile.Writer(job, fs, content.toString(), Text.class, Content.class, compType, progress);
            }
   
            // 如果Fetcher对抓取的内容进行了解析，这里就定义相应的解析输出抽象
            // 注意这里使用了ParseOutputFormat的getReocrdWriter,主要是解析网页，抽取其外链接
            if (Fetcher.isParsing(job)) {
                parseOut = new ParseOutputFormat().getRecordWriter(fs, job, name, progress);
            }
        }
   
   
        public void write(Text ;key, NutchWritable value)
                         throws IOException {
            Writable w = value.get();
            // 对对象类型进行判断，调用相应的抽象输出，写到不同的文件中去
            if (w instanceof CrawlDatum)
                fetchOut.append(key, w);
            else if (w instanceof Content)
                contentOut.append(key, w);
            else if (w instanceof Parse)
                parseOut.write(key, (Parse)w);
        }
   
        public void close(Reporter reporter) throws IOException {
            fetchOut.close();
            if (contentOut != null) {
                contentOut.close();
            }
   
   
            if (parseOut != null) {
                parseOut.close(reporter);
            }
        }
    };
}
{% endhighlight %}

## 3. 生产者QueueFeeder的介绍 {#queue-feeder}

这个类作用是用于生产被抓取的`FetchItem`对象，把其放入抓取队列中。下来我们来对其源代码进行分析

{% highlight bash %}
// 这个类继承自Thread，是用一个单独的线程来做的
private static class QueueFeeder extends Thread {
    private RecordReader<Text, CrawlDatum> reader; // 这里是InputFormat产生的ReocrdReader，用于读取Generate的产生的数据
    private FetchItemQueues queues;                // 这是生产者与消费者所使用的共享队列，这个对列是分层的，分一层对应一个host
    private int size;                              // 队列的大小
    private long timelimit = -1;                   // 这是一个过滤机制的策略，用于过滤所有的FetchItem
      
    // 构造方法
    public QueueFeeder(RecordReader<Text, CrawlDatum> reader,
                       FetchItemQueues queues, int size) {
        this.reader = reader;
        this.queues = queues;
        this.size = size;
        this.setDaemon(true);
        this.setName("QueueFeeder");
    }
   
    public void setTimeLimit(long tl) {
        timelimit = tl;
    }
   
    // 函数的run方法
    public void run() {
        boolean hasMore = true; // while的循环条件
        int cnt = 0;
        int timelimitcount = 0;
        while (hasMore) {
            // 这里判断是否设置了这个过滤机制，如果设置了，判断相前时间是否大于这个timelimit，如果大于timelimit，过滤所有的FetchItem
            if (System.currentTimeMillis() >= timelimit && timelimit != -1) {
                // enough .. lets's simply
                // read all the entries from the input without processing them
                try {
                    // 读出<key,value>对，过滤之
                    Text url = new Text();
                    CrawlDatum datum = new CrawlDatum();
                    hasMore = reader.next(url, datum);
                    timelimitcount++;
                } catch (IOException e) {
                    LOG.fatal("QueueFeeder error reading input, record " + cnt, e);
                    return;
                }
                continue; // 过滤之
            }
            int feed = size - queues.getTotalSize();
            // 判断剩余的队列空间是否为0
            if (feed <= 0) {
                // queues are full - spin-wait until they have some free space
                try {
                    // 休息1秒种
                    Thread.sleep(1000);
                } catch (Exception e) {};
                continue;
            } else {
                LOG.debug("-feeding " + feed + " input urls ...");
                // 如果队列还有空间(feed>0)并且recordRedder中还有数据(hasMore)
                while (feed > 0 && hasMore) {
                    try {
                        Text url = new Text();
                        CrawlDatum datum = new CrawlDatum();
                        // 读出<key,value>
                        hasMore = reader.next(url, datum);
                        if (hasMore) {       // 判断是否成功读出数据
                            queues.addFetchItem(url, datum); // 放入对列，这个队列应该是thread-safe的，下面我们可以看到
                            cnt++;       // 统计总数
                            feed--;      // 剩余队列空间减1
                        }
                    } catch (IOException e) {
                        LOG.fatal("QueueFeeder error reading input, record " + cnt, e);
                        return;
                    }
                }
            }
        }
        LOG.info("QueueFeeder finished: total " + cnt + " records + hit by time limit :" + timelimitcount);
    }
}
{% endhighlight %}

这个类主要负责向队列中放数据。

## 4. 下面我们来看一下这个队列是如果工作的 {#how-does-the-queue-do-the-job}

这里的共享对列主要如三个类组成，一个是`FetchItem`，存储队列中的元素;另一个是`FetchItemQueue`，用于存储相同host的`FetchItem`，最后一个是`FetchItemQueues`,看名字我们就知道，这是用于存储所有的`FetchItemQueue`的。

#### 4.1 先让我们来看一下FetchItem的结构：

	FetchItem =>
	{
    	queueID:String,              // 用于存储队列的ID号
    	url:Text,                    // 用于存储CrawlDatum的url地址
    	u:URL,                       // 也是存储url,但是以URL的类型来存储，不过这东东在判断RobotRules的时候用了一下
    	datum:CrawlDatum             // 这是存储抓取对象的一些元数据信息
	}

下面我们来看一下它的create方法，是用来生成相应的FetchItem的，源代码如下：

{% highlight java %}
//从注释中我们可以看到，队列ID是由protocol+hotname或者是protocol+IP组成的
/** Create an item. Queue id will be created based on byIP
 * argument, either as a protocol + hostname pair, or protocol + IP
 * address pair.
 */
public static FetchItem create(Text url, CrawlDatum datum, boolean byIP) {
    String queueID;
    URL u = null;
    try {
        u = new URL(url.toString()); // 得到其URL
    } catch (Exception e) {
        LOG.warn("Cannot parse url: " + url, e);
        return null;
    }
    // 得到协议号
    String proto = .getProtocol().toLowerCase();
    String host;
    if (byIP) {
        // 如果是基于IP的，那得到其IP地址
        try {
            InetAddress addr = InetAddress.getByName(u.getHost());
            host = addr.getHostAddress();
        } catch (UnknownHostException e) {
            // unable to resolve it, so don't fall back to host name
            LOG.warn("Unable to resolve: " + u.getHost() + ", skipping.");
            return null;
        }
    } else {
        // 否则得到Hostname
        host = u.getHost();
        if (host == null) {
            LOG.warn("Unknown host for url: " + url + ", skipping.");
            return null;
        }
        hosthost = host.toLowerCase(); // 统一变小写
    }
    // 得成相应的队列ID号，放入FetchItemQueue中
    queueID = proto + "://" + host;
    return new FetchItem(url, u, datum, queueID);
}
{% endhighlight %}

#### 4.2 下面我们来看一下FetchQueue的组成结构

这个类主要是用于收集相同QueueID的`FetchItem`对象，对正在抓取的`FetchItem`进行跟踪，使用的是一个inProgress集合，还有计算两次请求的间隔时间，我们来看一下其结构：

{% highlight java %}
FetchQueue =>
   
{
    // 用于收集相同QueueID的FetchItem, 这里使用的是线程安全的对象
    List<FetchItem> queue = Collections.synchronizedList(new LinkedList<FetchItem>());
    // 用于收集正在抓取的FetchItem
    Set<FetchItem> inProgress = Collections.synchronizedSet(new HashSet<FetchItem>());
    // 用于存储下一个FetchItem的抓取时候，如果没有到达这个时间，就返回给FetchThread为null
    AtomicLong nextFetchTime = new AtomicLong();
    // 存储抓取的出错次数
   
    AtomicInteger exceptionCounter = new AtomicInteger();
    // 存储FetchItem抓取间隔，这个配置只有当同时抓取最大线程数为1时才有用
    long crawlDelay;
    // 存储最小的抓取间隔，这个配置当同时抓取的最大线程数大于1时有用
    long minCrawlDelay;
   
    // 同时抓取的最大线程数
    int maxThreads;
    Configuration conf;
}
{% endhighlight %}

我们主要还看一下其`getFetchItem`方法：

{% highlight java %}
public FetchItem getFetchItem() {
    // 当正在抓取的FetchItem数大于同时抓取的线程数时，返回null,这是一个politness策略
    // 就是对于同一个网站，不能同时有大于maxThreads个线程在抓取，不然人家网站会认为你是在攻击它
    if (inProgress.size() >= maxThreads) return null;
    long now = System.currentTimeMillis();
    // 计算两个抓取的间隔时间，如果没有到达这个时间，就返回null，这个是保证不会有多个线程同时在抓取一个网站
    if (nextFetchTime.get() > now) return null;
    FetchItem it = null;
    // 判断队列是否为空
    if (queue.size() == 0) return null;
    try {
        // 从准备队列中移除一个FetchItem,把其放到inProcess集合中
        it = queue.remove(0);
        inProgress.add(it);
    } catch (Exception e) {
        LOG.error("Cannot remove FetchItem from queue or cannot add it to inProgress queue", e);
    }
    return it;
}
{% endhighlight %}

这里还有一个方法是`finishFetchItem`,就是当这个`FetchItem`被抓了完成后，会调用这个方法，这个方法会把这个`FetchItem`从inProgress集合中删除，然后再更新一下`nextFetchTime`

{% highlight java %}
nextFetchTime = endTime + (maxThread > 1) ? minCrawlDelay : crawlDelay)
{% endhighlight %}

#### 4.3 下面再来看一下FetchItemQueues

这个类主要是用来管理`FetchItemQueue`,下面介绍一下其主要的几个方法：

* `synchronized addFetchItem(FetchItem it)`: 是用来把FetchItem根据其QueueID号放到对应的`FetchItemQueue`中
* `synchronized getFetchItem()` : 它是遍历`FetchItemQueue`，从中得到一个`FetchItem`，如果没有就返回`null`
* `synchronized checkExceptionThreshold` : 用于查看特定`FetchItemQueue`的抓取失败次数，当这个次数大于`maxExceptionsPerQueue`时，就清空这个`FetchItemQueue`中的其它`FetchItem`.  

## 5. Fetcher的Mapper模型 {#mapper-model}

Fetcher.java代码中可以看到，`Fetcher`继承自`MapRunable`,它是`Mapper`的抽象接口，实现这个接口的子类能够更好的对Map的流程进行控制，包括多线程与异步`Maper`。

#### 5.1 Fetcher的入口函数`fetch(Path segment,int threads, boolean parsing)`

下面是它的源代码，来分析一下：

{% highlight java %}
// 对配置进行检测，看一些必要的配置是否已经配置了，如http.agent.name等参数 &nbsp;
   
checkConfiguration();
   
// 记录fetch的开始时间
   
SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
   
long start = System.currentTimeMillis();
   
if (LOG.isInfoEnabled()) {
   
    LOG.info("Fetcher: starting at " + sdf.format(start));
   
    LOG.info("Fetcher: segment: " + segment);
   
}
   
// 这里对抓取的时候进行限制,在FetchItemQueue中会用到这个参数
   
// set the actual time for the timelimit relative
   
// to the beginning of the whole job and not of a specific task
   
// otherwise it keeps trying again if a task fails
   
long timelimit = getConf().getLong("fetcher.timelimit.mins", -1);
   
if (timelimit != -1) {
   
    timelimit = System.currentTimeMillis() + (timelimit * 60 * 1000);
   
    LOG.info("Fetcher Timelimit set for : " + timelimit);
   
    getConf().setLong("fetcher.timelimit", timelimit);
   
}
   
// 生成一个Nutch的Map-Reduce配置
   
JobConf job = new NutchJob(getConf());
   
job.setJobName("fetch " + segment);
   
// 配置抓取线程数;
   
job.setInt("fetcher.threads.fetch", threads);
   
job.set(Nutch.SEGMENT_NAME_KEY, segment.getName());
   
// 配置是否对抓取的内容进行解析
   
job.setBoolean("fetcher.parse", parsing);
   
// for politeness, don't permit parallel execution of a single task
   
job.setSpeculativeExecution(false);
   
// 配置输入的路径名
   
FileInputFormat.addInputPath(job, new Path(segment, CrawlDatum.GENERATE_DIR_NAME));
   
// 配置输入的文件格式, 这里类继承自SequenceFileInputFormat
   
// 它主要是覆盖了其getSplits方法，其作用是不对文件进行切分，以文件数量作为splits的依据
   
// 就是有几个文件，就有几个Map操作
   
job.setInputFormat(InputFormat.class);
   
// 配置Map操作的类
   
job.setMapRunnerClass(Fetcher.class);
   
// 配置输出路径
   
FileOutputFormat.setOutputPath(job, segment);
   
// 这里配置输出文件方法，这个类在前面已经分析过
   
job.setOutputFormat(FetcherOutputFormat.class);
   
// 配置输出<key,value>类型
   
job.setOutputKeyClass(Text.class);
   
job.setOutputValueClass(NutchWritable.class);
   
JobClient.runJob(job);
{% endhighlight %}

#### 5.2 Fetcher的run方法分析

这个是Map类的入口，用于启动抓取的生产者与消费者，下面是部分源代码:

{% highlight java %}
// 生成生产者，用于读取Generate出来的CrawlDatum，把它们放到共享队列中
   
feeder = new QueueFeeder(input, fetchQueues, threadCount * 50);
   
//feeder.setPriority((Thread.MAX_PRIORITY + Thread.NORM_PRIORITY) /2);
   
// the value of the time limit is either -1 or the time where it should finish
   
long timelimit = getConf().getLong("fetcher.timelimit", -1);
   
if (timelimit != -1) feeder.setTimeLimit(timelimit);
   
feeder.start();
   
// set non-blocking & no-robots mode for HTTP protocol plugins.
   
getConf().setBoolean(Protocol.CHECK_BLOCKING, false);
   
getConf().setBoolean(Protocol.CHECK_ROBOTS, false);
   
   
// 启动消费者线程
for (int i = 0; i < threadCount; i++) {       // spawn threads
    new FetcherThread(getConf()).start();
}
   
// select a timeout that avoids a task timeout
long timeout = getConf().getInt("mapred.task.timeout", 10*60*1000)/2;
   
// 这里用一个循环来等待线程结束
do {
    try {
        Thread.sleep(1000);
    } catch (InterruptedException e) {}
   
    // 这个函数是得到相前线程的抓取状态，如抓取了多少网页，多少网页抓取失败，抓取速度是多少
    reportStatus();
    LOG.info("-activeThreads=" + activeThreads + ", spinWaiting=" + spinWaiting.get()
        + ", fetchQueues.totalSize=" + fetchQueues.getTotalSize());
    // 输出抓取队列中的信息
    if (!feeder.isAlive() && fetchQueues.getTotalSize() < 5) {
    fetchQueues.dump();
    }
   
   
    // 查看timelimit的值，这里只要返回的hitByTimeLimit不为0, checkTimelimit方法会清空抓取队列中的所有数据
    // check timelimit
    if (!feeder.isAlive()) {
    int hitByTimeLimit = fetchQueues.checkTimelimit();
    if (hitByTimeLimit != 0) reporter.incrCounter("FetcherStatus",
                    "hitByTimeLimit", hitByTimeLimit);
    }
   
   
    // 查看抓取线程是否超时，如果超时，就退出等待
    // some requests seem to hang, despite all intentions
    if ((System.currentTimeMillis() - lastRequestStart.get()) > timeout) {
        if(LOG.isWarnEnabled()) {
            LOG.warn("Aborting with " + activeThreads + " hung threads.");
        }
        return;
    }
   
} while (activeThreads.get() > 0);
   
LOG.info("-activeThreads=" + activeThreads);
{% endhighlight %}

## 6. Fetcher.FetcherThread

#### 6.1 这个类主要是用来从队列中得到`FetchItem`，下面来看一下其`run`方法，其大概做了几件事：

1. 从抓取队列中得到一个`FetchItem`，如果返回为`null`,判断生产者是否还活着或者队列中是否还有数据，  如果队列中还有数据，那就等待，如果上面条件没有满足，就认为所有`FetchItem`都已经处理完了，退出当前抓取线程
2. 得到`FetchItem`, 抽取其url，从这个url中分析出所使用的协议，调用相应的plugin来解析这个协议
3. 得到相当url的robotRules，看是否符合抓取规则，如果不符合或者其delayTime大于我们配置的`maxDelayTime`，那就不抓取这个网页
4. 对网页进行抓取，得到其抓取的`Content`和抓取状态，调用`FetchItemQueues`的`finishFetchItem`方法，表明当前url已经抓取完成
* 如果状态为`WOULDBLOCK`，那就进行retry,把当前url放加`FetchItemQueues`中，进行重试
* 如果是`MOVED`或者`TEMP_MOVED`,这时这个网页可以被重定向了，对其重定向的内容进行解析，得到重定向的网址，这时要生成一个新的`FetchItem`，根据其QueueID放到相应的队列的`inProgress`集合中，然后再对这个重定向的网页进行抓取
* 如果状态是`EXCEPTION`,对当前url所属的`FetchItemQueue`进行检测，看其异常的网页数有没有超过最大异常网页数，如果大于，那就清空这个队列，认为这个队列中的所有网页都有问题。
* 如果状态是`RETRY`或者是`BLOCKED`，那就输出`CrawlDatum`，将其状态设置成`STATUS_FETCH_RETRY`,在下一轮进行重新抓取
* 如果状态是`GONE`,`NOTFOUND`,`ACCESS_DENIED`,`ROBOTS_DENIED`，那就输出`CrawlDatum`，设置其状态为`STATUS_FETCH_GONE`，可能在下一轮中就不进行抓取了，
* 如果状态是`NOTMODIFIED`，那就认为这个网页没有改变过，那就输出其`CrawlDatum`，将其状态设成成`STATUS_FETCH_NOTMODIFIED`.
* 如果所有状态都没有找到，那默认输出其`CrawlDatum`,将其状态设置成`STATUS_FETCH_RETRY`，在下一轮抓取中再重试, 根据抓取协议的状态来进行下一步操作
5. 判断网页重定向的次数，如果超过最大重定向次数，就输出其`CrawlDatum`，将其状态设置成`STATUS_FETCH_GONE`

这里有一些细节没有说明，如网页被重定向以后如果操作，相应的协议是如果产生的，这个是通过插件产生的，具体插件是怎么调用的，这里就不说了，以后有机会会再分析一下。

#### 6.2 下面分析`FetcherThread`中的另外一个比较重要的方法，就是output

具体这个output大概做了如下几件事：

1. 判断抓取的`content`是否为空，如果不为空，那调用相应的解析插件来对其内容进行解析，然后就是设置当前url所对应的`CrawlDatum`的一些参数，如当前内容的MD5码，分数等信息
2. 然后就是使用`FetchOutputFormat`输出当前url的`CrawlDatum`,Content和解析的结果`ParseResult`

下面分析一下`FetcherOutputFormat`中所使用到的`ParseOutputFormat.RecordWriter`

在生成相应的`ParseOutputFormat`的`RecordWriter`过程中，这个`RecordWriter`会再生成三个`RecordWriter`来写出`parse_text(MapFile)`,`parse_data(MapFile)`和c`rawl_parse(SequenceFile)`，我们在segments下具体的segment中看到的三个这样的目录就是这个对象生成的，分 据，如网页title、外链接、元数据、状态等信息，这里会对外链接进行过滤、规格化，并且用插件计算每一个外链接的初始分数;另一个是网页解析后的`CrawlDatum`对象，这里会分析当前`CrawlDatum`中的metadata，从中生成两种新的`CrawlDatum`，还有就是它会对外链接生成相应的`CrawlDatum`，放入crawl_parse目录中，这里我还没有看明白。

## 7. 总结 {#summary}

#### 7.1 从目录生成的角度

从Generate后会在segments目录下生成一些要抓取的具体的segment，这里每一个segment下会有一个叫crawl_generate的目录，其中放着要抓取`CrawlDatum`信息

在Fetch的时候，会输出另外五个目录

* `content`: 这个目录只有在配置了要输出抓取内容时才会输出
* `crawl_fetch`: 这个目录是输出抓取成功后的CrawlDatum信息，这里是对原来`crawl_generate`目录中的信息进行了一些修改，下面三个目录只有配置了解析参数后才会输出，如果后面调用`bin/nutch parse`命令
* `parse_text`: 这个目录存放了抓取的网页内容，以提后面建立索引用
* `parse_data`: 这里存入了网页解析后的一些数据，如网页title,外链接信息等
* `crawl_parse`: 这里存储了一些新生成的`CrawlDatum`信息，如外链接等，以供下一次迭代抓取使用

#### 7.2 从数据流的角度

Generate生成的`CrawlDatum`数据首先经过`QueueFeeder`生产者，放入共享队列
多个消费者(`FetcherThread`)从共享队列中取得要抓取的`FetchItem`数据
对`FetchItem`所对应的url进行抓取，得到相应的抓取内容，对抓取的状态进行判断，回调相应的操作
对抓取的内容进行解析，产生网页的外链接，生成新的`CrawlDatum`抓取数据，产生解析后的数据
调用`FetcherOutputFormat.Writer`对象，把`CrawlDatum`,`Content`,`ParseResult`分别写入`crawl_fetch`,`content`,(`parse_text`,`parse_data`,`crawl_parse`)目录中