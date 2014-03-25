---
layout: post
title: "Algorithm of Searching"
category: Lucene
tags: [lucene, search]
---

## Algorithm

This section is mostly notes on stepping through the Scoring process and serves as fertilizer for the earlier sections.

In the typical search application, a [Query](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Query.html) is passed to the [Searcher](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Searcher.html) , beginning the scoring process.

Once inside the Searcher, a [Collector](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Collector.html) is used for the scoring and sorting of the search results. These important objects are involved in a search:

* The [Weight](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Weight.html) object of the Query. The Weight object is an internal representation of the Query that allows the Query to be reused by the Searcher.
* The Searcher that initiated the call.
* A [Filter](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Filter.html) for limiting the result set. Note, the Filter may be null.
* A [Sort](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Sort.html) object for specifying how to sort the results if the standard score based sort method is not desired.

Assuming we are not sorting (since sorting doesn't effect the raw Lucene score), we call one of the search methods of the Searcher, passing in the [Weight](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Weight.html) object created by Searcher.createWeight(Query), [Filter](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Filter.html) and the number of results we want. This method returns a [TopDocs](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/TopDocs.html) object, which is an internal collection of search results. The Searcher creates a [TopScoreDocCollector](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/TopScoreDocCollector.html) and passes it along with the Weight, Filter to another expert search method (for more on the [Collector](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Collector.html) mechanism, see [Searcher](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Searcher.html) .) The TopDocCollector uses aPriorityQueue to collect the top results for the search.

If a Filter is being used, some initial setup is done to determine which docs to include. Otherwise, we ask the Weight for a [Scorer](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Scorer.html) for the [IndexReader](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/index/IndexReader.html) of the current searcher and we proceed by calling the score method on the [Scorer](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Scorer.html) .

At last, we are actually going to score some documents. The score method takes in the Collector (most likely the TopScoreDocCollector or TopFieldCollector) and does its business. Of course, here is where things get involved. The [Scorer](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Scorer.html) that is returned by the [Weight](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Weight.html) object depends on what type of Query was submitted. In most real world applications with multiple query terms, the [Scorer](http://lucene.apache.org/core/3_6_0/api/core/org/apache/lucene/search/Scorer.html) is going to be a [BooleanScorer2](http://svn.apache.org/viewvc/lucene/dev/trunk/lucene/core/src/java/org/apache/lucene/search/BooleanScorer2.java?view=log) (see the section on customizing your scoring for info on changing this.)

Assuming a BooleanScorer2 scorer, we first initialize the Coordinator, which is used to apply the coord() factor. We then get a internal Scorer based on the required, optional and prohibited parts of the query. Using this internal Scorer, the BooleanScorer2 then proceeds into a while loop based on the Scorer#next() method. The next() method advances to the next document matching the query. This is an abstract method in the Scorer class and is thus overriden by all derived implementations. If you have a simple OR query your internal Scorer is most likely a DisjunctionSumScorer, which essentially combines the scorers from the sub scorers of the OR'd terms.