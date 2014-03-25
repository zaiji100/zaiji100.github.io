---
layout: post
title: "The Changes in Nutch2"
category: Nutch
tags: [nutch, nutch2]
---
Nutch 2.0 的主要一些变化

## 1. Storage Abstraction

initially with back end implementations for HBase and HDFS extend it to other storages later e.g. MySQL etc...

这里说的是一个存储层的抽象，因为原来nutch的链接与数据的存储都是在HDFS上的，新的Nutch 2.0准备把存储层进行抽象，使用的是新的NoSql的ORM框架，叫做GORA,下面地址中有其说明<http://wiki.apache.org/nutch/GORA_HBase>，主页在<http://incubator.apache.org/gora/>，目前支持数据库为Apache HBase and Apache Cassandra，Hypertable，以后可能会支持MySQL

## 2. Plugin cleanup

Tika only for parsing document formats (see <http://wiki.apache.org/nutch/TikaPlugin>)

keep only stuff HtmlParseFilters (probably with a different API) so that we can post-process the DOM created in Tika from  whatever original format. Modify code so that parser can generate multiple documents which is what 1.x does but not 2.0

对插件功能的整理。

## 3. Externalize functionalities to crawler-commons project [<http://code.google.com/p/crawler-commons/>]

robots handling, url filtering and url normalization, URL state management, perhaps deduplication. We should coordinate our efforts, and share code freely so that other projects (bixo, heritrix,droids) may contribute to this shared pool of functionality, much like Tika does for the common need of parsing complex formats.

把Nutch的抓取功能抽象出来，生成一个common工程，以扩展到现有的不同的网页抓取库，如heritrix,bixo等。

## 4. Remove index / search and delegate to SOLR

we may still keep a thin abstract layer to allow other indexing/search backends (ElasticSearch?), but the current mess of  indexing/query filters and competing indexing frameworks (lucene, fields, solr) should go away. We should go directly from DOM to a NutchDocument, and stop there.

这一部分是对索引的重构，把索引的建立与查询移到SOLR架构上去，这样可以和搜索进行很好的隔离，现在的nutch 1.3 已经可以使用Solr建立索引与查询，可能Nutch 2.0的功能或者使用上会有一个更加的改进。

## 5. Rewrite SOLR deduplication

do everything using the webtable and avoid retrieving content from SOLR

这是对SOLR的deduplication代码的一个重构。

## 6. Various new functionalities

e.g. sitemap support, canonical tag, better handling of redirects, detecting duplicated sites, detection of spam cliques, tools to manage the webgraph, etc.

一些新的特性，如sitemap的支持，这个在crawler-commons项目有，更好的去处理网页的重定向，检查重复的网站等，还有一些去处理webgraph的外围工具都会完善起来。