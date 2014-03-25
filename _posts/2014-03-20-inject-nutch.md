---
layout: post
title: "Inject - Nutch"
category: Nutch
tags: [hadoop, nutch, injecting, map-reduce]
---
## 1. Inject的作用 {#what-is-inject}

在Nutch中Inject是用来把文本格式的url列表注入到抓取数据库中，一般是用来引导系统的初始化。

这里的文本格式如下：

	http://www.nutch.org/   nutch.score=10  nutch.fetchInterval=2592000 userType=open_source

## 2. 运行Inject命令 {#inject-command}

{% highlight bash %}
$ bin/nutch inject <url_dir> <crawl_db>
{% endhighlight %}

在本地运行后的输出结果如下：

<div class="bs-callout bs-callout-info">
	<p>Injector: starting at 2011-08-23 10:14:10</p>
	<p>Injector: crawlDb: db/crawldb</p>
	<p>Injector: urlDir: urls</p>
	<p>Injector: Converting injected urls to crawl db entries.</p>
	<p>Injector: Merging injected urls into crawl db.</p>
	<p>Injector: finished at 2011-08-23 10:14:12, elapsed: 00:00:02</p>
	<p>Injector: starting at 2011-08-23 10:14:10</p>
	<p>Injector: crawlDb: db/crawldb</p>
	<p>Injector: urlDir: urls</p>
	<p>Injector: Converting injected urls to crawl db entries.</p>
	<p>Injector: Merging injected urls into crawl db.</p>
	<p>Injector: finished at 2011-08-23 10:14:12, elapsed: 00:00:02</p>
</div>

你可以用如下命令来查看其数据库内容

{% highlight bash %}
bin/nutch readdb <crawl_db> -stats -sort
{% endhighlight %}

在本机的输出如下：

<div class="bs-callout bs-callout-info">
	<p>CrawlDb statistics start: db/crawldb</p>
	<p>Statistics for CrawlDb: db/crawldb</p>
	<p>TOTAL urls: 1</p>
	<p>retry 0: 1</p>
	<p>min score: 1.0</p>
	<p>avg score: 1.0</p>
	<p>max score: 1.0</p>
	<p>status 1 (db_unfetched): 1</p>
	<p>&nbsp; &nbsp;www.baidu.com : 1</p>
	<p>CrawlDb statistics: done</p>
	<p>rawlDb statistics start: db/crawldb</p>
	<p>Statistics for CrawlDb: db/crawldb</p>
	<p>TOTAL urls:1</p>
	<p>retry 0:1</p>
	<p>min score:1.0</p>
	<p>avg score:1.0</p>
	<p>max score:1.0</p>
	<p>status 1 (db_unfetched):1</p>
	<p>  www.baidu.com :1</p>
	<p>CrawlDb statistics: done</p>
</div>

## 3. Inject源代码分析 {#the-source-of-injecting}

我们知道Injector.java在Nutch源代码中的位置为`org.apache.nutch.crawl.Injector.java`, 其中有一个main入口函数使用Hadoop的工具类ToolRunner来运行其实例, 但其是终入口函数还是void inject(Path crawlDb, Path urlDir), 其中有两个MP任务: 第一个主要是把文件格式的输入转换成&lt;url,CrawlDatum&gt;格式的输出，这里的CrawlDatum是Nutch对于单个抓取url对象的一个抽象，其中有很多url的相关信息,第二个MP主要是把上面新生成的输出与旧的CrawlDb数据进行合并，生成一个新的CrawlDb

### 3.1 对于Inject中第一个MP任务的分析

第一个MP任务主要代码如下：

{% highlight java %}
JobConf sortJob = new NutchJob(getConf());                 // 生成一个Nutch的配置抽象
sortJob.setJobName("inject " + urlDir);
FileInputFormat.addInputPath(sortJob, urlDir);             // 设置InputFormat，这里为FileInputFormat,这里要注意的是可以调用多次addInputPath这个方法，效果是会有多个输入源
sortJob.setMapperClass(InjectMapper.class);                // 这里设置了Mapper方法，主要是用于解析、过滤和规格化url文本，把其转换成<url,CrawlDatum>格式
FileOutputFormat.setOutputPath(sortJob, tempDir);          // 这里定义了一个输出路径，这里的tempDir=mapred.temp.dir/inject-temp-Random()
sortJob.setOutputFormat(SequenceFileOutputFormat.class);   // 这里配置了输出格式，这里为SequenceFileOutputFormat，这是MP的一种二进制输出结构
sortJob.setOutputKeyClass(Text.class);                     // 这里配置了MP的输出<key,value>的类型，这里为<Text,CrawlDatum>
sortJob.setOutputValueClass(CrawlDatum.class);
sortJob.setLong("injector.current.time", System.currentTimeMillis());
JobClient.runJob(sortJob);                                 // 这里用于提交任务到JobTracker，让其运行任务
{% endhighlight %}

这里对InjectMapper中的主要代码进行分析：

这个类主要用于对url进行解析、过滤和规格化

{% highlight java %}
public void map(WritableComparable key, Text value, OutputCollector<Text, CrawlDatum> output, Reporter reporter) throws IOException {
    String url = value.toString();                                            // value is line of text
    if (url != null && url.trim().startsWith("#")) {                          // 这里以#号开头的文本就过滤
        /* Ignore line that start with # */
        return;
    }
    // if tabs : metadata that could be stored
    // must be name=value and separated by \t
    float customScore = -1f;
    int customInterval = interval;
    Map<String,String> metadata = new TreeMap<String,String>();                // 设置属性的一个容器
    if (url.indexOf("\t") != -1) {
        String[] splits = url.split("\t");                                     // 对一行文本进行切分
        url = splits[0];
        for (int s = 1; s < splits.length; s++) {
            // find separation between name and value
            int indexEquals = splits[s].indexOf("=");
            if (indexEquals == -1) {
                // skip anything without a =
                continue;
            }
            String metaname = splits[s].substring(0, indexEquals);              // 得到元数据的名字
            String metavalue = splits[s].substring(indexEquals+1);              // 得到元数据的值
            if (metaname.equals(nutchScoreMDName)) {                            // 看是不是保留的元数据
                try {
                    customScore = Float.parseFloat(metavalue);
                } catch (NumberFormatException nfe) {}
            } else if (metaname.equals(nutchFetchIntervalMDName)) {
                try {
                    customInterval = Integer.parseInt(metavalue);
                } catch (NumberFormatException nfe){}
            } else metadata.put(metaname,metavalue);                             // 如果这个元数据不是保留的元数据，就放到容器中
        }
    }
    try {
        url = urlNormalizers.normalize(url, URLNormalizers.SCOPE_INJECT);        // 对url进行规格化，这里调用的是plugins中的插件
        url = filters.filter(url);                                               // 以url进行过滤
    } catch (Exception e) {
        if (LOG.isWarnEnabled()) { LOG.warn("Skipping " +url + ":" + e); }
        url = null;
    }
    if (url != null) {                                                           // if it passes
        value.set(url);                                                          // collect it // 这里生成一个CrawlDatum对象，设置一些url的初始化数据
        CrawlDatum datum = new CrawlDatum(CrawlDatum.STATUS_INJECTED, customInterval);
        datum.setFetchTime(curTime);                                             // 设置当前url的抓取时间
        // now add the metadata
        Iterator<String> keysIter = metadata.keySet().iterator();
        while (keysIter.hasNext()){                                              // 配置其元数据
            String keymd = keysIter.next();
            String valuemd = metadata.get(keymd);
            datum.getMetaData().put(new Text(keymd), new Text(valuemd));
        } // 设置初始化分数
        if (customScore != -1) datum.setScore(customScore);
        else datum.setScore(scoreInjected);
        try { // 这里对url的分数进行初始化
            scfilters.injectedScore(value, datum);
        } catch (ScoringFilterException e) {
            if (LOG.isWarnEnabled()) {
                LOG.warn("Cannot filter injected score for url " + url
                         + ", using default (" + e.getMessage() + ")");
            }
        }
        // Map 收集相应的数据，类型为<Text,CrawlDatum>
        output.collect(value, datum);
    }
}
{% endhighlight %}

### 3.2 第二个MP任务的分析

第二个MP任务主要是对crawlDb进行合并，源代码如下:

{% highlight java %}
// merge with existing crawl db
JobConf mergeJob = CrawlDb.createJob(getConf(), crawlDb);                      // 这里对Job进行相应的配置
FileInputFormat.addInputPath(mergeJob, tempDir);                               // 这里配置了输入的文本数据，就是上面第一个MP任务的输出
mergeJob.setReducerClass(InjectReducer.class);                                 // 这里配置了Reduce的抽象类，这里会覆盖上面createJob设置的Reduce类
JobClient.runJob(mergeJob);                                                    // 提交运行任务
CrawlDb.install(mergeJob, crawlDb);                                            // 把上面新生成的目录重命名为crawlDb的标准文件夹名，然后再删除老的目录
// clean up
FileSystem fs = FileSystem.get(getConf());
fs.delete(tempDir, true);                                                      // 把第一个MP任务的输出目录删除
{% endhighlight %}

下面是createJob的源代码说明：

{% highlight java %}
public static JobConf createJob(Configuration config, Path crawlDb) throws IOException {            // 生成新的CrawlDb文件名
    Path newCrawlDb = new Path(crawlDb,Integer.toString(new Random().nextInt(Integer.MAX_VALUE)));
    JobConf job = new NutchJob(config);                                                             // 生成相应的Job配置抽象
    job.setJobName("crawldb " + crawlDb);
    Path current = new Path(crawlDb, CURRENT_NAME);
    if (FileSystem.get(job).exists(current)) {             // 如果存在老的CrawlDb目录，将其加入InputPath路径中，和上面的tempDir一起进行合并
        FileInputFormat.addInputPath(job, current);
    }
    // NOTE：有没有注意到这里如果有老的CrawlDb目录的话，那它的文件格式是MapFileOutputFormat，
    // 而下面对其读取用了SequenceFileInputFormat来读，因为这两个类底层都是调用了SequenceFile的Reader与Writer来读写的，所以可以通用。
    job.setInputFormat(SequenceFileInputFormat.class);     // 设置CrawlDb目录文件的格式为SequenceFileInputFormat
    job.setMapperClass(CrawlDbFilter.class);               // 设置相应的Map操作，主要是过滤和规格化url
    job.setReducerClass(CrawlDbReducer.class);             // 设置相应的Reduce操作，主要是对url进行聚合
    FileOutputFormat.setOutputPath(job, newCrawlDb);       // 设置新的输出路径
    job.setOutputFormat(MapFileOutputFormat.class);        // 设置输出的格式，这里是MapFileOutputFormat
    job.setOutputKeyClass(Text.class);                     // 这里设置了输出的类型<Text,CrawlDatum>
    job.setOutputValueClass(CrawlDatum.class);
    return job;
}
{% endhighlight %}

下面来看看覆盖的InjectReducer都干了些什么，部分源代码如下：

{% highlight java %}
public void reduce(Text key, Iterator<CrawlDatum> values, OutputCollector<Text, CrawlDatum> output, Reporter reporter) throws IOException {
	// 把相同url聚合后的结果进行处理，这个循环主要是新注入的url与老的url有没有相同的， 
	// 如果有相同的话就不设置其状态，支持collect出去了
    boolean oldSet = false; 
    while (values.hasNext()) {
        CrawlDatum val = values.next();
        if (val.getStatus() == CrawlDatum.STATUS_INJECTED) {
            injected.set(val);
            injected.setStatus(CrawlDatum.STATUS_DB_UNFETCHED);
        } else {
            old.set(val);
            oldSet = true;
        }
    }
    CrawlDatum res = null;
    if (oldSet) res = old; // don't overwrite existing value
    else res = injected;
    output.collect(key, res);
}
{% endhighlight %}

最后来看一下CrawlDb.install方法都干了些什么，其源代码如下：

{% highlight java %}
public static void install(JobConf job, Path crawlDb) throws IOException {
    Path newCrawlDb = FileOutputFormat.getOutputPath(job);                                         // 得到第二个MP任务的输出目录
    FileSystem fs = new JobClient(job).getFs();
    Path old = new Path(crawlDb, "old");
    Path current = new Path(crawlDb, CURRENT_NAME);                                                // 得到CrawlDb的正规目录名，也就是有没有老的CrawlDb
    if (fs.exists(current)) {                                                                      // 如果有老的CrawlDb目录，把老的目录名生命名为old这个名字
        if (fs.exists(old)) fs.delete(old, true);                                                  // 这里判断old这个目录是不是已经存在，如果存在就删除之
        fs.rename(current, old);
    }
    fs.mkdirs(crawlDb);
    fs.rename(newCrawlDb, current);                                                                // 这里是把第二个MP任务的输出目录重命名为current目录，也就是正规目录名
    if (fs.exists(old)) fs.delete(old, true);                                                      // 删除重使名后的老的CrawlDb目录
    Path lock = new Path(crawlDb, LOCK_NAME);
    LockUtil.removeLockFile(fs, lock);                                                             // 目录解锁
}
{% endhighlight %}

## 4. Injection过程总结 {#summary}

Inject主要是从文本文件中注入新的url，使其与老的crawlDb中的url进行合并，然后把老的CrawlDb目录删除，现把新生成的CrawlDb临时目录重命名为CrawlDb目录名。
流程如下：

<div class="bs-callout bs-callout-info">
	url_dir -> MapReduce1(inject new urls) -> MapReduece2(merge new urls with old crawlDb) -> install new CrawlDb -> clean up
</div>