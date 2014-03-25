---
layout: post
title: "GeneratorJob - Nutch2"
category: Nutch
tags: [hadoop, nutch, map-reduce, generate, nutch2]
---
`GeneratorJob`主要作用是读取`InjectorJob`输出的结果，根据条件过滤URL，`Fetched`间隔以及是否超过同一个Host可crawl数量过滤URL，并将过滤后的URL作为Fetch列表

## 任务配置 {#job-configuration}

{% highlight java %}
public Map<String,Object> run(Map<String,Object> args) throws Exception {
    ...
    int randomSeed = Math.abs(new Random().nextInt());
    batchId = (curTime / 1000) + "-" + randomSeed;
    getConf().setInt(GENERATOR_RANDOM_SEED, randomSeed);
    getConf().set(BATCH_ID, batchId);  // 设置一个随机的BatchId，在Reducer中会用它来标示WebPage的Generate状态
    ...
    numJobs = 1;
    currentJobNum = 0;
    currentJob = new NutchJob(getConf(), "generate: " + batchId);
    // 设置Storage类为WebPage，Mapper类为GeneratorMapper，并且根据配置按照Host，Domain或IP来将map输出的结果
    // 分组到不同的Reducer中
    StorageUtils.initMapperJob(currentJob, FIELDS, SelectorEntry.class,
        WebPage.class, GeneratorMapper.class, SelectorEntryPartitioner.class, true);
    StorageUtils.initReducerJob(currentJob, GeneratorReducer.class);
    currentJob.waitForCompletion(true);
    ToolUtil.recordJobStatus(null, currentJob, results);
    results.put(BATCH_ID, batchId);
    return results;
  }
{% endhighlight %}


## Mapper

Mapper负责的主要工作有如下几项：

* 根据`DbUpdater`的`distance`来过滤URL（TBD，需要查看`DbUpdater`在何种情况下更新`distance`）
* normalize，filter 输入的URLs
* 通过`FetchSechedule`查看URL是否到了fetch时间，如果没到，则过滤
* 计算URL的抓取分数，并与URL组成Mapper的输出Key

{% highlight java %}
@Override
  public void map(String reversedUrl, WebPage page,
      Context context) throws IOException, InterruptedException {
    String url = TableUtil.unreverseUrl(reversedUrl);
 
    if (Mark.GENERATE_MARK.checkMark(page) != null) {    // 如果该URL已经被Generate过，则忽略
      if (GeneratorJob.LOG.isDebugEnabled()) {
        GeneratorJob.LOG.debug("Skipping " + url + "; already generated");
      }
      return;
    }
 
    //filter on distance
    if (maxDistance > -1) {
      Utf8 distanceUtf8 = page.getFromMarkers(DbUpdaterJob.DISTANCE);
      if (distanceUtf8 != null) {
        int distance=Integer.parseInt(distanceUtf8.toString());
        if (distance > maxDistance) {
          return;
        }
      }
    }
 
 
    // If filtering is on don't generate URLs that don't pass URLFilters
    try {
      if (normalise) {
        url = normalizers.normalize(url, URLNormalizers.SCOPE_GENERATE_HOST_COUNT);
      }
      if (filter && filters.filter(url) == null)
        return;
    } catch (URLFilterException e) {
      if (GeneratorJob.LOG.isWarnEnabled()) {
        GeneratorJob.LOG.warn("Couldn't filter url: " + url + " (" + e.getMessage() + ")");
        return;
      }
    } catch (MalformedURLException e) {
      if (GeneratorJob.LOG.isWarnEnabled()) {
        GeneratorJob.LOG.warn("Couldn't filter url: " + url + " (" + e.getMessage() +")");
        return;
      }
    }
 
    // check fetch schedule
    if (!schedule.shouldFetch(url, page, curTime)) {
      if (GeneratorJob.LOG.isDebugEnabled()) {
        GeneratorJob.LOG.debug("-shouldFetch rejected '" + url + "', fetchTime=" +
            page.getFetchTime() + ", curTime=" + curTime);
      }
      return;
    }
    float score = page.getScore();
    try {
      // 计算Fetch分数，根据该分数选择TopN
      score = scoringFilters.generatorSortValue(url, page, score);
    } catch (ScoringFilterException e) {
      //ignore
    }
    entry.set(url, score);
    context.write(entry, page);
  }
{% endhighlight %}

## Reducer

由于`SelectorEntry`的`compairTo`方法，mapper方法输出的结果将按照score的倒序排序，并按照Domain，Host分配到不同的Reducer节点

{% highlight java %}
// count 与limit均为类成员变量
@Override
protected void reduce(SelectorEntry key, Iterable<WebPage> values,
      Context context) throws IOException, InterruptedException {
    for (WebPage page : values) {
      // 如果URL已经超过TopN，直接返回
      if (count >= limit) {
        return;
      }
      if (maxCount > 0) {
        String hostordomain;
        // 取出URL的Domain或者Host部分，用来计算每个Host或Domain下已存在的URL个数
        if (byDomain) {
          hostordomain = URLUtil.getDomainName(key.url);
        } else {
          hostordomain = URLUtil.getHost(key.url);
        }
 
        Integer hostCount = hostCountMap.get(hostordomain);
        if (hostCount == null) {
          hostCountMap.put(hostordomain, 0);
          hostCount = 0;
        }
        // 如果一个Host或Domain下的URL已经超限，则直接返回
        if (hostCount >= maxCount) {
          return;
        }
        hostCountMap.put(hostordomain, hostCount + 1);
      }
      // 将GeneratorJob中生成的batchId标记到WebPage中，表明该WebPage已经被generate过
      Mark.GENERATE_MARK.putMark(page, batchId);
      try {
        context.write(TableUtil.reverseUrl(key.url), page);
      } catch (MalformedURLException e) {
        context.getCounter("Generator", "MALFORMED_URL").increment(1);
        continue;
      }
      context.getCounter("Generator", "GENERATE_MARK").increment(1);
      count++;
    }
  }
{% endhighlight %}