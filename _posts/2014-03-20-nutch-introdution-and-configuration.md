---
layout: post
title: "Nutch Introdution and Configuration"
description: "Nutch简介和配置"
category: Nutch
tags: [hadoop, nutch, crawler]
---
## 1. Nutch是什么? {#what-is-nutch}

Nutch是一个开源的网页抓取工具，主要用于收集网页数据，然后对其进行分析，建立索引，以提供相应的接口来对其网页数据进行查询的一套工具。其底层使用了Hadoop来做分布式计算与存储，索引使用了Solr分布式索引框架来做，Solr是一个开源的全文索引框架，从Nutch 1.3开始，其集成了这个索引架构

## 2. 在哪里要可以下载到最新的Nutch? {#where-can-we-download-nutch}

在下面地址中可以下载到最新的Nutch 1.3二进制包和源代码

<http://mirror.bjtu.edu.cn/apache//nutch/>

## 3. 如何配置Nutch? {#how-can-we-config-nutch}

### 1. 对下载后的压缩包进行解压，然后

{% highlight bash %}
$ cd $HOME/nutch-1.3/runtime/local
{% endhighlight %}

### 2. 配置bin/nutch这个文件的权限，使用

{% highlight bash %}
$ chmod +x bin/nutch
{% endhighlight %}

### 3. 配置JAVA_HOME，使用

{% highlight bash %}
$ export JAVA_HOME=$PATH
{% endhighlight %}

## 4. 抓取前要做什么准备工作? {#what-should-i-do-before-fetching}

### 1. 配置http.agent.name这个属性，如下

{% highlight xml %}
<property>
  <name>http.agent.name</name>
  <value>My Nutch Spider</value>
</property>
{% endhighlight %}

### 2. 建立一个地址目录,mkdir -p urls

在这个目录中建立一个url文件，写上一些url，如

<http://nutch.apache.org/>

### 3. 然后运行如下命令

{% highlight bash %}
$ bin/nutch crawl urls -dir crawl -depth 3 -topN 5
{% endhighlight %}

注意，这里是不带索引的，如果要对抓取的数据建立索引，运行如下命令

{% highlight bash %}
$ bin/nutch crawl urls -solr http://localhost:8983/solr/ -depth 3 -topN 5
{% endhighlight %}

## 5. Nutch的抓取流程是什么样子的? {#how-does-nutch-fetch-pages}

### 1. 初始化crawlDb，注入初始url

{% highlight bash %}
$ bin/nutch inject
Usage: Injector <crawldb> <url_dir>
{% endhighlight %}

在我本地运行这个命令后的输出结果如下：

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ bin/nutch inject db/crawldb urls/ 
       Injector: starting at 2011-08-22 10:50:01 
       Injector: crawlDb: db/crawldb 
       Injector: urlDir: urls 
       Injector: Converting injected urls to crawl db entries. 
       Injector: Merging injected urls into crawl db. 
       Injector: finished at 2011-08-22 10:50:05, elapsed: 00:00:03
{% endhighlight %}

### 2. 产生新的抓取urls

{% highlight bash %}
$ bin/nutch generate 
    Usage: Generator <crawldb> <segments_dir> [-force] [-topN N] [-numFetchers numFetchers] [-adddays numDays] [-noFilter] [-noNorm][-maxNumSegments num]
{% endhighlight %}

本机输出结果如下： 

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ bin/nutch generate db/crawldb/ db/segments 
        Generator: starting at 2011-08-22 10:52:41 
        Generator: Selecting best-scoring urls due for fetch. 
        Generator: filtering: true 
        Generator: normalizing: true 
        Generator: jobtracker is 'local', generating exactly one partition. 
        Generator: Partitioning selected urls for politeness. 
        Generator: segment: db/segments/20110822105243   // 这里会产生一个新的segment 
        Generator: finished at 2011-08-22 10:52:44, elapsed: 00:00:03
{% endhighlight %}

### 3. 对上面产生的url进行抓取

<http://www.tudou.com/>

{% highlight bash %}
$ bin/nutch fetch 
    Usage: Fetcher <segment> [-threads n] [-noParsing]
{% endhighlight %}

这里是本地的输出结果：

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ bin/nutch fetch db/segments/20110822105243/ 
        Fetcher: Your 'http.agent.name' value should be listed first in 'http.robots.agents' property. 
        Fetcher: starting at 2011-08-22 10:56:07 
        Fetcher: segment: db/segments/20110822105243 
        Fetcher: threads: 10 
        QueueFeeder finished: total 1 records + hit by time limit :0 
        fetching http://www.tudou.com/;
        -finishing thread FetcherThread, activeThreads=1 
        -finishing thread FetcherThread, activeThreads= 
        -finishing thread FetcherThread, activeThreads=1 
        -finishing thread FetcherThread, activeThreads=1 
        -finishing thread FetcherThread, activeThreads=0 
        -activeThreads=0, spinWaiting=0, fetchQueues.totalSize=0 
        -activeThreads=0 
        Fetcher: finished at 2011-08-22 10:56:09, elapsed: 00:00:02
{% endhighlight %}

我们来看一下这里的segment目录结构

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ ls db/segments/20110822105243/
content  crawl_fetch  crawl_generate
{% endhighlight %}

### 4. 对上面的结果进行解析 

{% highlight bash %}
$ bin/nutch parse 
Usage: ParseSegment segment
{% endhighlight %}

本机输出结果：

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ bin/nutch parse db/segments/20110822105243/ 
    ParseSegment: starting at 2011-08-22 10:58:19 
    ParseSegment: segment: db/segments/20110822105243 
    ParseSegment: finished at 2011-08-22 10:58:22, elapsed: 00:00:02
{% endhighlight %}

我们再来看一下解析后的目录结构

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ ls db/segments/20110822105243/
content  crawl_fetch  crawl_generate  crawl_parse  parse_data  parse_text
{% endhighlight %}

这里多了三个解析后的目录。 

### 5. 更新外链接数据库

{% highlight bash %}
$ bin/nutch updatedb 
    Usage: CrawlDb <crawldb> (-dir <segments> | <seg1> <seg2> ...) [-force] [-normalize] [-filter] [-noAdditions]
{% endhighlight %}

本机输出结果：

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ bin/nutch updatedb db/crawldb/ -dir db/segments/ 
    CrawlDb update: starting at 2011-08-22 11:00:09 
    CrawlDb update: db: db/crawldb 
    CrawlDb update: segments: [file:/home/lemo/Workspace/java/Apache/Nutch/nutch-1.3/db/segments/20110822105243] 
    CrawlDb update: additions allowed: true 
    CrawlDb update: URL normalizing: false 
    CrawlDb update: URL filtering: false 
    CrawlDb update: Merging segment data into db. 
    CrawlDb update: finished at 2011-08-22 11:00:10, elapsed: 00:00:01
{% endhighlight %}

这时它会更新crawldb链接库，这里是放在文件系统中的，像taobao抓取程序的链接库是用redis来做的，一种key-value形式的NoSql数据库。

### 6. 计算反向链接

{% highlight bash %}
$ bin/nutch invertlinks 
Usage: LinkDb <linkdb> (-dir <segmentsDir> | <seg1> <seg2> ...) [-force] [-noNormalize] [-noFilter]
{% endhighlight %}

本地输出结果：

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ bin/nutch invertlinks db/linkdb -dir db/segments/ 
    LinkDb: starting at 2011-08-22 11:02:49 
    LinkDb: linkdb: db/linkdb 
    LinkDb: URL normalize: true 
    LinkDb: URL filter: true 
    LinkDb: adding segment: file:/home/lemo/Workspace/java/Apache/Nutch/nutch-1.3/db/segments/20110822105243 (file:/home/lemo/Workspace/java/Apache/Nutch/nutch-1.3/db/segments/20110822105243  );
    LinkDb: finished at 2011-08-22 11:02:50, elapsed: 00:00:01
{% endhighlight %}

### 7. 使用Solr为抓取的内容建立索引

{% highlight bash %}
$ bin/nutch solrindex 
    Usage: SolrIndexer <solr url*> <crawldb> <linkdb> (<segment> ... | -dir <segments>*
{% endhighlight %}

Nutch端的输出如下：

{% highlight bash %}
lemo@debian:~/Workspace/java/Apache/Nutch/nutch-1.3$ bin/nutch solrindex http://127.0.0.1:8983/solr/ db/crawldb/ db/linkdb/ db/segments/
   SolrIndexer: starting at 2011-08-22 11:05:33 
   SolrIndexer: finished at 2011-08-22 11:05:35, elapsed: 00:00:02
{% endhighlight %}

Solr端的部分输出如下：

<div class="bs-callout bs-callout-info">
	 <p>INFO: SolrDeletionPolicy.onInit: commits:num=1</p>
     <p> commit{dir=/home/lemo/Workspace/java/Apache/Solr/apache-solr-3.3.0/example/solr/data/index,segFN=segments_1,version=1314024228223,generation=1,filenames=[segments_1]</p>  
     <p> Aug 22, 2011 11:05:35 AM org.apache.solr.core.SolrDeletionPolicy updateCommits  </p>
     <p> INFO: newest commit = 1314024228223  </p>
     <p> Aug 22, 2011 11:05:35 AM org.apache.solr.update.processor.LogUpdateProcessor finish  </p>
     <p> INFO: {add=[http://www.baidu.com/]} 0 183  </p>
     <p> Aug 22, 2011 11:05:35 AM org.apache.solr.core.SolrCore execute  </p>
     <p> INFO: [] webapp=/solr path=/update params={wt=javabin&amp;version=2} status=0 QTime=183  </p>
     <p> Aug 22, 2011 11:05:35 AM org.apache.solr.update.DirectUpdateHandler2 commit  </p>
     <p> INFO: start commit(optimize=false,waitFlush=true,waitSearcher=true,expungeDeletes=false)  </p>
</div>

### 8. 在Solr的客户端查询

在浏览器中输入 `http://localhost:8983/solr/admin/`
tudou
输出的XML结构为
如果你要以HTML结构显示把Solr的配置文件`solrconfig.xml`中的content改为如下就可以

{% highlight xml %}
<field stored="true" indexed="true"/>
{% endhighlight %}

{% highlight xml %}
<response>
   
    <lst name="responseHeader">
        <int name="status">0</int>
        <int name="QTime">0</int>
        <lst name="params">
            <str name="indent">on</str>
            <str name="start">0</str>
            <str name="q">baidu</str>
            <str name="version">2.2</str>
            <str name="rows">10</str>
        </lst>
    </lst>
   
    <result name="response" numFound="1" start="0">
        <doc>
            <float name="boost">1.0660036</float>
            <str name="digest">7be5cfd6da4a058001300b21d7d96b0f</str>
            <str name="id">http://www.baidu.com/</str>
            <str name="segment">20110822105243</str>
            <str name="title">百度一下，你就知道</str>
            <date name="tstamp">2011-08-22T14:56:09.194Z</date>
            <str name="url">http://www.baidu.com/</str>
        </doc>
     </result>
</response>
{% endhighlight %}

## 6 参考 {#reference}

<http://wiki.apache.org/nutch/RunningNutchAndSolr>