---
layout: post
title: "CrawlDbReader - Nutch"
category: Nutch
tags: [hadoop, nutch, injecting, map-reduce]
---
## CrawlDbReader工具的使用方法 {#how-to-use-crawldbreader}

Injection过程钟将文本文件中的URL注入到CrawlDb中，CrawlDb可以使用CrawlDbReader来读取和分析。在命令行中运行`bin/nutch readdb`后就可以看到其帮助，实际上这个shell方法调用的正是CrawlDbReader的main方法，这个工具有下面几种使用方法：

{% highlight bash %}
$ bin/nutch <crawldb> -stats -sort
{% endhighlight %}

这个方法是在终端中打印所有crawldb的统计信息，加上sort后，会输出所有host所对应的url的个数，一般格式如下

{% highlight bash %}
$ bin/nutch readdb db/crawldb/ -stats -sort
   
    CrawlDb statistics start: db/crawldb/
    Statistics for CrawlDb: db/crawldb/
    TOTAL urls: 5 retry 0: 5
    min score: 0.045
    avg score: 0.09955
    max score: 1.136
    status 1 (db_unfetched): 4
        baike.baidu.com : 1
        hi.baidu.com : 2
        home.baidu.com : 1
        image.baidu.com : 1
    status 2 (db_fetched): 1
        www.baidu.com : 1
    CrawlDb statistics: done
{% endhighlight %}

其他一些命令：

{% highlight bash %}
$ bin/nutch <crawldb> -dump <out_dir> [-format normal|csv]
   
--这个方法主要是把CrawlDb中的数据转成一般的文本格式或者是csv格式，输出到out_dir目录中
 
$ bin/nutch <crawldb> -url <url>
--这个方法主要是打印出特定url的信息
 
$ bin/nutch <crawldb> -topN nnn <out_dir> [<min>]
--这个方法主要是输出前topN个分数大于min的url，输出到out_dir中，默认这个min为0.0
{% endhighlight %}

本地的输出如下

{% highlight bash %}
$ bin/nutch readdb db/crawldb/ -topN 3 out
     
    CrawlDb topN: starting (topN=3, min=0.0)
    CrawlDb db: db/crawldb/
    CrawlDb topN: collecting topN scores.
    CrawlDb topN: done
 
$ cat out/part-00000
    1.1363636 http://www.baidu.com/
    0.045454547 http://tieba.baidu.com/
    0.045454547 http://baike.baidu.com/
{% endhighlight %}

简单分析一下上面四个流程的源代码

## 在终端中打印所有crawldb的统计信息 {#show-stats}

{% highlight bash %}
$ bin/nutch <crawldb> -stats -sort
{% endhighlight %}

这个命令是调用CrawlDbReader中的processStatJob(String CrawlDb,Configuration config,boolean sort)来解决掉的

下面用一个MP任务对CrawlDb数据库进行统计，主要代码如下:

{% highlight java %}
JobConf job = new NutchJob(config);                                      // 生成一个Job的配置对象
job.setJobName("stats " + crawlDb);
job.setBoolean("db.reader.stats.sort", sort);                            // 配置是否要进行sort操作，这个标记会在CrawlDbStatMapper中用到 // 下面是配置输入路径
FileInputFormat.addInputPath(job, new Path(crawlDb, CrawlDb.CURRENT_NAME));
job.setInputFormat(SequenceFileInputFormat.class);                       // 这里配置输入的文件格式，这里实际上是MapSequenceFileInputFormat,这不过这两个是通用的
job.setMapperClass(CrawlDbStatMapper.class);                             // 这里配置Mapper方法
job.setCombinerClass(CrawlDbStatCombiner.class);                         // 这里配置一个Combiner方法，这个方法主要是在Mapper端对数据进行聚合，起到了优化作用
job.setReducerClass(CrawlDbStatReducer.class);                           // 这里配置了相应的Reduce方法
FileOutputFormat.setOutputPath(job, tmpFolder);                          // 输出目录
job.setOutputFormat(SequenceFileOutputFormat.class);                     // 输出的文件格式  ，
                                                                         // NOTE:这里补充说明一下，所有通过OutputFormat的数据都要继承自Hadoop的序列化框架接口Writable，
                                                                         // 用于把这个对象序列化与反序列化，这里的Text这是继承自Writable接口的，
                                                                         // 所以你自定义的抽象类型要使用Hadoop的架构写出到文件中的话，一定要记得继承Writable接口
job.setOutputKeyClass(Text.class);                                       // 下面是输出的<key,value>的类型，这里为<Text,LongWritable>
job.setOutputValueClass(LongWritable.class);
JobClient.runJob(job);                                                   // 提交任务
{% endhighlight %}

下面来看一下CrawlDbStatMapper方法做了些什么，部分源代码如下：

{% highlight java %}
public void map(Text key, CrawlDatum value, OutputCollector<Text, LongWritable> output, Reporter reporter) throws IOException {
    output.collect(new Text("T"), COUNT_1);                                               // 这里统计所有url出现的次数，在Reduce端会对这个key T进行聚合，不过在
                                                                                          // 每一个Map端会调用相应的Combiner进行本地聚合来优化
    output.collect(new Text("status " + value.getStatus()), COUNT_1);                     // 来统计每一种url状态的个数
    output.collect(new Text("retry " + value.getRetriesSinceFetch()), COUNT_1);           // 这里统计被重新抓取的url个数
    output.collect(new Text("s"), new LongWritable((long) (value.getScore() * 1000.0)));  // 这个统计所有url的分数这和
    if(sort){                                                        // 这个参数是configure方法得到的，代码：sort = job.getBoolean("db.reader.stats.sort", false );
        URL u = new URL(key.toString());
        String host = u.getHost();
        output.collect(new Text("status " + value.getStatus() + " " + host), COUNT_1);    // 这里统计相同状态,相同host的url的个数
    }
}
{% endhighlight %}

这里来看一下CrawlDbStatCombiner做了些什么，这个类是继承自Reducer这个抽象类的，部分代码如下：

{% highlight java %}
if (!k.equals("s")) {                                                                      // 这里统计除分数外的所有相同key的value值之各
    while (values.hasNext()) {
        LongWritable cnt = (LongWritable)values.next();
        val.set(val.get() + cnt.get());
    }
    output.collect(key, val);
} else {                                                                                   // 这里统计相同key的分数之和,这里的key就是上面Mapper中输出的's'，就是所有url的分数
    long total = 0;
    long min = Long.MAX_VALUE;
    long max = Long.MIN_VALUE;
    while (values.hasNext()) {
        LongWritable cnt = (LongWritable)values.next();
        if (cnt.get() < min) min = cnt.get();                                               // 计算最小分数
        if (cnt.get() > max) max = cnt.get();                                               // 计算最大分数
        total += cnt.get();                                                                 // 计算总分
    }
    output.collect(new Text("scn"), new LongWritable(min));                                 // 输出这个Mapper节点上的最小分数
    output.collect(new Text("scx"), new LongWritable(max));                                 // 输出这个Mapper节点上的最大分数
    output.collect(new Text("sct"), new LongWritable(total));                               // 输出这个Mapper节点上的总分
}
{% endhighlight %}

Hadoop中的Combiner主要的作用是对Mapper的输出进行次优化，以减少Reducer的scoket的网络传输数据量

最后看一下那个CrawlDbStatReducer方法，主要代码如下：

{% highlight java %}
String k = ((Text) key).toString();
if (k.equals("T")) {                                                       // 这里统计所有url的个数
    // sum all values for this key
    long sum = 0;
    while (values.hasNext()) {
        sum += ((LongWritable) values.next()).get();
    }
    // output sum
    output.collect(key, new LongWritable(sum));
} else if (k.startsWith("status") || k.startsWith("retry")) {              // 这里统计所有key中包含"status"与"retry"字段的value的值
    LongWritable cnt = new LongWritable();
    while (values.hasNext()) {
        LongWritable val = (LongWritable)values.next();
        cnt.set(cnt.get() + val.get());
    }
    output.collect(key, cnt);
} else if (k.equals("scx")) {                                               // 这里计算url分数的max值
    LongWritable cnt = new LongWritable(Long.MIN_VALUE);
    while (values.hasNext()) {
        LongWritable val = (LongWritable)values.next();
        if (cnt.get() < val.get()) cnt.set(val.get());
    }
    output.collect(key, cnt);
} else if (k.equals("scn")) {                                               // 这里统计url分数的min值
    LongWritable cnt = new LongWritable(Long.MAX_VALUE);
    while (values.hasNext()) {
        LongWritable val = (LongWritable)values.next();
        if (cnt.get() > val.get()) cnt.set(val.get());
    }
    output.collect(key, cnt);
} else if (k.equals("sct")) {                                               // 这里统计所有url的总分
    LongWritable cnt = new LongWritable();
    while (values.hasNext()) {
        LongWritable val = (LongWritable)values.next();
        cnt.set(cnt.get() + val.get());
    }
    output.collect(key, cnt);
}
{% endhighlight %}

在processStatJob这个方法中最所还要读取上面MP的输出，对其数据进行规格化输出，这里就不分析了，只是要注意一点，代码如下

{% highlight java %}
// reading the result
FileSystem fileSystem = FileSystem.get(config);
SequenceFile.Reader[] readers = SequenceFileOutputFormat.getReaders(config, tmpFolder);
{% endhighlight %}

这里使用了SequenceFileOutputFormat的Reader来读取其内容，在Reader中有一个叫next(key,value)的方法来读取相应的&lt;key,value&gt;对

## 将CrawlDb中的数据在文件中输出 {#dump-to-file}

{% highlight bash %}
$ bin/nutch <crawldb> -dump <out_dir> [-format normal|csv]
{% endhighlight %}

这个命令是调用`CrawlDbReader`中的`processDumpJob`方法来做的，这个方法也是提交了一个MP任务，不过这个MP任务相对来说很简单了，就是定义了`InputFormat`与`OutputFormat`，没有定义Map与Reducer操作，来对CrawlDb的数据进行转换。

## 打印特定url的信息 {#show-url-info}

{% highlight bash %}
$ bin/nutch <crawldb> -url <url>
{% endhighlight %}

这个命令是调用`CrawlDbReader`中的get方法来做的，主要用到了两个方法，一个是：

{% highlight java %}
private void openReaders(String crawlDb, Configuration config) throws IOException {
    if (readers != null) return;
    FileSystem fs = FileSystem.get(config);
    readers = MapFileOutputFormat.getReaders(fs, new Path(crawlDb, CrawlDb.CURRENT_NAME), config);
}
{% endhighlight %}

这个方法主要是用于得到相应的Readers抽象，输入为CrawlDb的目录名，这个目录的文件格式为`MapFileOutputFormat`

另一个方法是：

{% highlight java %}
CrawlDatum res = (CrawlDatum) MapFileOutputFormat.getEntry(readers, new HashPartitioner<Text, CrawlDatum>(), key, val);
{% endhighlight %}

根据上面得到的readers，通过`MapFileOutputFormat`的static方法`getEntry`来得到key(url)所对应的value(CrawlDatum),注意这里getEntry返回的类型为Writable抽象，这里要cast一下. 

## 输出前几个大于min的urls {#show-topn-urls}

{% highlight bash %}
$ bin/nutch <crawldb> -topN nnn <out_dir> [<min>]
{% endhighlight %}

这个命令是调用CrawlDbReader中的processTopNJob方法来估物，这里也使用两个MP任务来做。

* 第一个MP任务主要是把&lt;url,CrawlDatum&gt;转换成&lt;score,url&gt;的格式，过滤那些score小于min的数据，用来准备数据
* 第二个MP任务主要是用来对score进行排序，产生topN个url，输出到一个文件中，因为这里设置了`job.setNumReduceTasks(1)`.

<div class="alert alert-info">
<i class="fa fa-info-circle"><span class="sr-only">INFO</span></i> 这里为什么要用两个MP任务，主要是因为这里的key是score，如果用一个MP任务，那在Reducer的时候就会对相同的key进行聚合，这时就会出问题，而这里第一个MP任务是不对key进行聚合的，这里使用了IdnetityReducer。
</div>