---
layout: post
title: "Map-Reduce in Nutch"
category: Nutch
tags: [hadoop, nutch, map-reduce]
---
Nutch从获取下载列表到建立索引的过程： 

插入url列表到Crawl DB，引导下面的抓取程序

循环:
 
  * 从Crawl DB生成一些url列表;
  * 抓取内容;
  * 分析处理抓取的内容;
  * 更新Crawl DB库.
转化每个页面中外部对它的链接

建立索引 

具体技术实现细节： 

## 插入url列表（Inject） {#inject}

`org.apache.nutch.crawl.Injector`

MapReduce程序1:

 目标:转换input输入为CrawlDatum格式. 

 输入: url文件  Map(line) → &lt;url, CrawlDatum&gt;

 Reduce()合并多重的Url.

 输出:临时的CrawlDatum文件.

 MapReduce2:

  目标:合并上一步产生的临时文件到新的DB

  输入: 上次MapReduce输出的CrawlDatum

  Map()过滤重复的url.

  Reduce: 合并两个CrawlDatum到一个新的DB

  输出:CrawlDatum 

## 生成抓取列表（Generate） {#generate}

`org.apache.nutch.crawl.Generator`

MapReduce程序1:

  目标:选择抓取列表

  输入: Crawl DB 文件

  Map() → 如果抓取当前时间大于现在时间 ,抓换成 &lt;CrawlDatum, url&gt;格式.

  分发器(Partition) :用url的host保证同一个站点分发到同一个Reduce程序上.

  Reduce:取最顶部的N个链接.

---

 MapReduce程序2:

  目标:准备抓取

  Map() 抓换成 &lt;url,CrawlDatum&gt;格式

  分发器(Partition) :用url的host

  输出:&lt;url,CrawlDatum&gt;文件

## 抓取内容（Fetch） {#fetch}

`org.apache.nutch.fetcher.Fetcher`

不像传统Map-Reduce程序实现Mapper和Reducer，而是 实现了MapRunnable接口来以多线程的形式执行Map任务，但Hadoop API并没有提供ReduceRunnable之类的接口。Fetcher中只运行Map任务。 

MapReduce:

  目标:抓取内容

  输入: &lt;url,CrawlDatum&gt;, 按host划分, 按hash排序

  Map(url,CrawlDatum) → 输出&lt;url, FetcherOutput&gt;

  多线程, 调用Nutch的抓取协议插件,抓取输出&lt;CrawlDatum, Content&gt;

  输出: &lt;url,CrawlDatum&gt;, &lt;url,Content&gt;两个文件 

## 分析处理内容（Parse） {#parse}

org.apache.nutch.parse.Parser 接口类，以插件的形式运行， 

MapReduce:

  目标:处理抓取的能容

  输入: 抓取的&lt;url, Content&gt;

  Map(url, Content) → &lt;url, Parse&gt;

  调用Nutch的解析插件,输出处理完的格式是&lt;parseText, ParseData&gt;

  输出: &lt;url,ParseText&gt;, &lt;url,ParseData&gt -&gt; &lt;url,CrawlDatum&gt;. 

## 更新Crawl DB库（Update ） {#updatedb}

`org.apache.nutch.crawl.CrawlDb`  Configured类

`org.apache.nutch.crawl.CrawlDbFilter`   Map类

`org.apache.nutch.crawl.CrawlDbReducer`   Reducer类

MapReduce:

  目标: 整合 fetch和parse到DB中

  输入:&lt;url,CrawlDatum&gt; 现有的db加上fetch和parse的输出,合并上面3个DB为一个新的DB

  输出: 新的抓取DB 

## 转化链接（Invert Links） {#invert-links}

`org.apache.nutch.crawl.LinkDb`  Configured&Mapper类

`org.apache.nutch.crawl.LinkDbMerger`     Combiner&Reducer类

MapReduce:

  目标:统计外部页面对本页面链接

  输入: &lt;url,ParseData&gt;, 包含页面往外的链接

  Map(srcUrl, ParseData&gt; → &lt;destUrl, Inlinks&gt;

  搜集外部对本页面的链接Inlinks格式:&lt;srcUrl, anchorText&gt;

  Reduce() 添加inlinks

  输出: &lt;url, Inlinks&gt;

## 建立索引（Index） {#index}

`org.apache.nutch.indexer.solr.SolrIndexer`  Configured类

`org.apache.nutch.indexer.IndexerMapReduce`  Mapper&Reducer 

MapReduce：

  目标:生成Lucene索引

  输入: 多种文件格式

  parse处理完的&lt;url, ParseData&gt; 提取title, metadata信息等

  parse处理完的&lt;url, ParseText&gt; 提取text内容

  转换链接处理完的&lt;url, Inlinks&gt; 提取anchors

  抓取内容处理完的&lt;url, CrawlDatum&gt; 提取抓取时间.

  Map() 用ObjectWritable包裹上面的内容

  Reduce() 调用Nutch的索引插件,生成Lucene Document文档

  输出: 输出Lucene索引 