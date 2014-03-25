---
layout: post
title: "The Introdution of Commands for Nutch"
description: "Nutch 运行命令介绍"
category: Nutch
tags: [hadoop, nutch, crawler]
---
要看Nutch的命令说明，可执行如下命令`bin/nutch`

{% highlight bash %}
$ bin/nutch
Usage: nutch [-core] COMMAND
  where COMMAND is one of:
  crawl          one-step crawler for intranets
  readdb         read / dump crawl db
  convdb         convert crawl db from pre-0.9 format
  mergedb        merge crawldb-s, with optional filtering
  readlinkdb     read / dump link db
  inject         inject new urls into the database
  generate       generate new segments to fetch from crawl db
  freegen        generate new segments to fetch from text files
  fetch          fetch a segment's pages
  parse          parse a segment's pages
  readseg        read / dump segment data
  mergesegs      merge several segments, with optional filtering and slicing
  updatedb       update crawl db from segments after fetching
  invertlinks   create a linkdb from parsed segments
  mergelinkdb    merge linkdb-s, with optional filtering
  solrindex      run the solr indexer on parsed segments and linkdb
  solrdedup      remove duplicates from solr
  solrclean      remove HTTP 301 and 404 documents from solr
  plugin         load a plugin and run one of its classes main()
 or
  CLASSNAME      run the class named CLASSNAME
Most commands print help when invoked w/o parameters.
Expert: -core option is for developers only. It avoids building the job jar, instead it simply includes classes compiled with ant compile-core.
NOTE: this works only for jobs executed in 'local' mode
{% endhighlight %}

# 单个命令的说明

## bin/nutch crawl

{% highlight bash %}
$ bin/nutch crawl
Usage: Crawl <urlDir> -solr <solrURL> [-dir d] [-threads n] [-depth i] [-topN N]
{% endhighlight %}

这是用于对urls进行一键式抓取的命令

## bin/nutch readdb 

{% highlight bash %}
$ bin/nutch readdb
Usage: CrawlDbReader <crawldb> (-stats | -dump <out_dir> | -topN <nnnn> <out_dir> [<min>] | -url <url>)
{% endhighlight %}

这是用于对crawldb数据库进行读取的命令，主要是用于dump相应的url文件

## bin/nutch convdb

这个命令主要用于把nutch 0.9的crawldb数据转换成1.3的格式

## bin/nutch mergedb

{% highlight bash %}
$ bin/nutch mergedb
Usage: CrawlDbMerger <output_crawldb> <crawldb1> [<crawldb2> <crawldb3> ...] [-normalize] [-filter]
{% endhighlight %}

这个命令主要用于合并多个crawldb数据库

## bin/nutch readlinkdb

{% highlight bash %}
$ bin/nutch readlinkdb
Usage: LinkDbReader <linkdb> {-dump <out_dir> | -url <url>)
{% endhighlight %}

主要用于读取invertlinks产生的链接数据

## bin/nutch inject

{% highlight bash %}
$ bin/nutch inject
Usage: Injector <crawldb> <url_dir>
{% endhighlight %}

主要用于把url_dir中的url注入到crawldb数据库中去

## bin/nutch generate

{% highlight bash %}
$ bin/nutch generate
Usage: Generator <crawldb> <segments_dir> [-force] [-topN N] [-numFetchers numFetchers] [-adddays numDays] [-noFilter] [-noNorm][-maxNumSegments num]
{% endhighlight %}

用于产生准备抓取的url列表

## bin/nutch freegen

{% highlight bash %}
$ bin/nutch freegen
Usage: FreeGenerator <inputDir> <segmentsDir> [-filter] [-normalize]
{% endhighlight %}

从文本文件中提取urls来产生新的抓取segment

## bin/nutch fetch

{% highlight bash %}
$ bin/nutch fetch
Usage: Fetcher <segment> [-threads n] [-noParsing]
{% endhighlight %}

主要用来对generate产生的urls进行抓取，这里用到了Hadoop架构，使用了一个FetcherOutputFormat来对其结果进行多目录输出

## bin/nutch parse

{% highlight bash %}
$ bin/nutch parse
Usage: ParseSegment segment
{% endhighlight %}

主要是对抓取的内容进行分析

## bin/nutch readseg

{% highlight bash %}
$ bin/nutch readseg
Usage: SegmentReader (-dump ... | -list ... | -get ...) [general options]
{% endhighlight %}

这个命令主要是输出segment的内容

## bin/nutch invertlinks

{% highlight bash %}
$ bin/nutch invertlinks
Usage: LinkDb <linkdb> (-dir <segmentsDir> | <seg1> <seg2> ...) [-force] [-noNormalize] [-noFilter]
{% endhighlight %}

这个命令主要是得到抓取内容的外链接数据

## bin/nutch solrindex

{% highlight bash %}
$ bin/nutch solrindex
Usage: SolrIndexer <solr url> <crawldb> <linkdb> (<segment> ... | -dir <segments>)
{% endhighlight %}

对抓以的内容进行索引建立，前提是要有solr环境。

## bin/nutch plugin

{% highlight bash %}
$ bin/nutch plugin
Usage: PluginRepository pluginId className [arg1 arg2 ...]
{% endhighlight %}

这个命令主要对插件进行测试，运行其main方法