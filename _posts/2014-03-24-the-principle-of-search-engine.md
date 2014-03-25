---
layout: post
title: "the Principle of Search Engine"
category: Lucene
tags: [lucene, search engine]
---

## 对内容进行索引 {#content-index}

## 搜索条件的解析 {#parse-query}

搜索条件分为两种，BooleanQuery和Full-Text Query

* BooleanQuery:类型 a>1 AND (b=12 OR c='Hello')，该类Query具有明确的逻辑性，结果只有是或否
* Full-Text Query：一般针对文本搜索，对搜索词，进行分词，完全匹配搜索词，可以纳入结果集，部分匹配也有可能纳入结果集，但排序时，可能会排在靠后的位置。

搜索引擎会将用户输入的条件解析为查询树

<img src="/assets/img/chaxun1.png" class="img-thumbnail">

针对Full-Text Query, 将文本进行分词，并形成一个具有逻辑的文本序列，例如将{queryString:搜索引擎原理}分词后形成{text:搜索 text:引擎 text:原理}，并根据搜索引擎默认设置查询操作符或用户指定的查询操作符来确定分词序列直接的逻辑关系，如果用户希望得到相对精确的搜索结果，则分词序列可能转换为{+text:搜索 +text:引擎 +text:原理}, 3个词必须全部命中才能纳入到结果中去

则查询树转变为一个简单的逻辑查询树

<img src="/assets/img/chaxun2.png" class="img-thumbnail">

## 搜索结果命中 {#hits}

针对上一步产生的查询树，将索引与该查询数进行比对，将符合查询条件的搜索结果纳入到搜索结果中

## 搜索结果排序 {#sorting}

### 1. 链接分析排序（PageRank）

#### a) 链接的重要性（互联网的排序中，该项会作为一个排序因子对排序结果进行影响）

可以假设如果一个网页被多次引用，则认为改网页是重要的，如果被一个重要的网页所引用，则认为自身也是重要的。

#### b) 文档内容的相关性

1. 可以假设一个词（Term）在一篇文档中出现次数越多，则认为该文档对于该Term的相关性越高，但是当一篇10000词的文档Doc1中TermA出现3次，而一篇100词的文档Doc2中TermA出现2次时，实际上Doc2对于TermA的相关性更高。所以我们可以认为Term在一篇文档中出现频率越高，文档对于该Term的相关性越高。
2. 不同词对于文档来说重要性也不同，如果共有10000份文档，TermA在1000份文档中出现过，TermB在100份文档出现过，那么则认为TermB的权重比TermA的要高。如果搜索TermA和TermB，匹配到TermB的结果应适当排在前面
3. 对于“的”，“是”，“中”，“和”，“得”，“地”之类的无意义的连词，不应该对文档排序产生影响。这一类词称之为“stopwords”。他们的权重应该为0

详见<http://zh.wikipedia.org/wiki/TF-IDF>

### 2.余弦相似度

我们可以将一个文档想象为一个向量，如果另外一个文档与该文档一致，那么这两个向量的夹角应该为0，如果两个向量的夹角很小，纳闷则认为这两个文档的相关度很高。