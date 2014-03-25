---
layout: post
title: "InjectorJob - Nutch2"
category: Nutch
tags: [hadoop, nutch, map-reduce, injecting, nutch2]
---
InjectorJob主要负责从Seeds文件夹下的文件中读取URL，并根据它以及其元信息创建WebPage实体

在nutch2.1中，完成Inject任务的类有Injector改为InjectorJob，而且由原来的两个MR任务，简化为1个MR任务。

## 任务配置 {#job-configuration}

{% highlight java %}
public Map<String,Object> run(Map<String,Object> args) throws Exception {
    getConf().setLong("injector.current.time", System.currentTimeMillis());
    Path input;
    Object path = args.get(Nutch.ARG_SEEDDIR);
    if (path instanceof Path) {
      input = (Path)path;
    } else {
      input = new Path(path.toString());
    }
    numJobs = 1;
    currentJobNum = 0;
    currentJob = new NutchJob(getConf(), "inject " + input);
    FileInputFormat.addInputPath(currentJob, input);  // 设置Seed目录
    currentJob.setMapperClass(UrlMapper.class);
    currentJob.setMapOutputKeyClass(String.class);
    currentJob.setMapOutputValueClass(WebPage.class);
    currentJob.setOutputFormatClass(GoraOutputFormat.class); // 设置是用Gora对结果进行输出
    DataStore<String, WebPage> store = StorageUtils.createWebStore(currentJob.getConfiguration(),
        String.class, WebPage.class);     // 为WebPage创建DataStore
    GoraOutputFormat.setOutput(currentJob, store, true);
    currentJob.setReducerClass(Reducer.class);  // Any reducer is fine.
    currentJob.setNumReduceTasks(0);  // 关闭Reducer
    currentJob.waitForCompletion(true);
    ToolUtil.recordJobStatus(null, currentJob, results);
    return results;
}
{% endhighlight %}

## Mapper

读取seeds文件，获取URLs，以及它们的元信息，规范化并过滤URL

### 输入输出

URL文件，&lt;行号，行文本&gt; → &lt;反转的URL，WebPage&gt;

由于在nutch 2.x中是用GORA抽象了计算结果存储过程，用户可以选择将Nutch的crawl结果存放在Hbase，Cassandra或Mysql，存储结构更像一条数据库的记录，所以在2.x中是用`WebPage`取代了原来的`CrawlDatum`.

URL将被反转作为Map的输出Key，例如`http://bar.foo.com:8983/to/index.html?a=b`，将会被处理为`com.foo.bar:http:8983/to/index.html?a=b`，这样处理有利于在Hbase中更好的存储，因为在同样域名下scan更快。

{% highlight java %}
	@Override
    protected void map(LongWritable key, Text value, Context context)
        throws IOException, InterruptedException {
      String url = value.toString();
 
      // if tabs : metadata that could be stored
      // must be name=value and separated by \t
      float customScore = -1f;
      int customInterval = interval;
      Map<String, String> metadata = new TreeMap<String, String>();
      if (url.indexOf("\t") != -1) {
        String[] splits = url.split("\t");     // 分别获取URL以及对应的元信息
        url = splits[0];
        for (int s = 1; s < splits.length; s++) {
          // find separation between name and value
          int indexEquals = splits[s].indexOf("=");
          if (indexEquals == -1) {
            // skip anything without a =
            continue;
          }
          String metaname = splits[s].substring(0, indexEquals);
          String metavalue = splits[s].substring(indexEquals + 1);
          if (metaname.equals(nutchScoreMDName)) {
            try {
              customScore = Float.parseFloat(metavalue);
            } catch (NumberFormatException nfe) {
            }
          } else if (metaname.equals(nutchFetchIntervalMDName)) {
            try {
              customInterval = Integer.parseInt(metavalue);
            } catch (NumberFormatException nfe) {
            }
          } else
            metadata.put(metaname, metavalue);
        }
      }
      try {
        url = urlNormalizers.normalize(url, URLNormalizers.SCOPE_INJECT); // 规范化URL
        url = filters.filter(url); // filter the url
      } catch (Exception e) {
        LOG.warn("Skipping " + url + ":" + e);
        url = null;
      }
      if (url == null)
        return;
 
 
      String reversedUrl = TableUtil.reverseUrl(url);   // 将URL翻转
      WebPage row = new WebPage();
      row.setFetchTime(curTime);
      row.setFetchInterval(customInterval);
 
 
      // now add the metadata
      Iterator<String> keysIter = metadata.keySet().iterator();
      while (keysIter.hasNext()) {
          String keymd = keysIter.next();
          String valuemd = metadata.get(keymd);
          row.putToMetadata(new Utf8(keymd), ByteBuffer.wrap(valuemd.getBytes()));
      }
 
 
      if (customScore != -1)
          row.setScore(customScore);
      else
          row.setScore(scoreInjected);
      try {
          scfilters.injectedScore(url, row);
      } catch (ScoringFilterException e) {
          if (LOG.isWarnEnabled()) {
              LOG.warn("Cannot filter injected score for url " + url
                      + ", using default (" + e.getMessage() + ")");
          }
      }
       
      row.putToMarkers(DbUpdaterJob.DISTANCE, new Utf8(String.valueOf(0)));
 
      Mark.INJECT_MARK.putMark(row, YES_STRING);   // 标记为Inject过程
      context.write(reversedUrl, row);   // 写到GORA中
    }
  }
{% endhighlight %}

## Reducer

`InjectorJob`采用默认的`Reducer`，也就是说直接将Mapper的输出写到配置好的OutputPath

## 总结 {#summary}

相较1.x版本，InjectorJob更为简洁，一方面借助了Hbase等数据存储的特性，免去了排重这一步，但当前库中如果存在该URL，并该URL已经被fetched，标记为Fetched状态，再次执行InjectorJob时，该URL是否被覆盖成Injected状态？