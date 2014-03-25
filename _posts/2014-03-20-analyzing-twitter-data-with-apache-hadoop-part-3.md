---
layout: post
title: "Analyzing Twitter Data with Apache Hadoop, Part 3"
category: Hadoop
tags: [twitter, hadoop, analyzing data, hive]
---
This is the third article in a series about analyzing Twitter data using some of the components of the Apache Hadoop ecosystem that are available in CDH (Cloudera’s open-source distribution of Apache Hadoop and related projects). If you’re looking for an introduction to the application and a high-level view, check out [the first article in the series](/hadoop/2014/03/20/analyzing-twitter-data-with-apache-hadoop.html).

In [the previous article in this series](/hadoop/2014/03/20/analyzing-twitter-data-with-apache-hadoop-part-2.html), we saw how Flume can be utilized to ingest data into Hadoop. However, that data is useless without some way to analyze the data. Personally, I come from the relational world, and SQL is a language that I speak fluently. [Apache Hive](http://hive.apache.org/) provides an interface that allows users to easily access data in Hadoop via SQL. Hive compiles SQL statements into MapReduce jobs, and then executes them across a Hadoop cluster.

In this article, we’ll learn more about Hive, its strengths and weaknesses, and why Hive is the right choice for analyzing tweets in this application.

## Characterizing Data

One of the first questions to ask when deciding on the right tool for the job is: “what does my data look like?” If your data has a very strict schema, and it doesn’t deviate from that schema, maybe you should just be using a relational database. [MySQL](http://www.mysql.com/) is just as free as Hive, and very effective for dealing with well-structured data. However, as you start to try to analyze data with less structure or with extremely high volume, systems like MySQL become less useful, and it may become necessary to move out of the relational world.

Unstructured, semi-structured, and poly-structured are all terms for data that doesn’t fit well into the relational model. This is data like [JSON](http://json.org/), XML, [RDF](http://en.wikipedia.org/wiki/Resource_Description_Framework), or other sorts of data with a schema that may vary from record to record. What do we do with this data? Here’s where Hive shines. Hive is extremely effective for dealing with data that doesn’t quite fit into the relational bucket, because it can process complex, nested types natively. Hive avoids the need for complicated transformations that might be otherwise necessary to handle this sort of data in a traditional relational system. Hive can also gracefully handle records that don’t strictly conform to a table’s schema. For example, if some columns are missing from a particular record, Hive can deal with the record by treating missing columns as NULLs.

In the Twitter analysis example, we loaded raw tweets into HDFS. Using the Twitter Streaming API, tweets are represented as [JSON blobs](https://gist.github.com/3725161).

{% highlight json %}
{
   "retweeted_status": {
      "contributors": null,
      "text": "#Crowdsourcing – drivers already generate traffic data for your smartphone to suggest alternative routes when a road is clogged. #bigdata",
      "geo": null,
      "retweeted": false,
      "in_reply_to_screen_name": null,
      "truncated": false,
      "entities": {
         "urls": [],
         "hashtags": [
            {
               "text": "Crowdsourcing",
               "indices": [
                  0,
                  14
               ]
            },
            {
               "text": "bigdata",
               "indices": [
                  129,
                  137
               ]
            }
         ],
         "user_mentions": []
      },
      "in_reply_to_status_id_str": null,
      "id": 245255511388336128,
      "in_reply_to_user_id_str": null,
      "source": "<a href=\"http://www.socialoomph.com\" rel=\"nofollow\">SocialOomph<\/a>",
      "favorited": false,
      "in_reply_to_status_id": null,
      "in_reply_to_user_id": null,
      "retweet_count": 0,
      "created_at": "Mon Sep 10 20:20:45 +0000 2012",
      "id_str": "245255511388336128",
      "place": null,
      "user": {
         "location": "Oregon, ",
         "default_profile": false,
         "statuses_count": 5289,
         "profile_background_tile": false,
         "lang": "en",
         "profile_link_color": "627E91",
         "id": 347471575,
         "following": null,
         "protected": false,
         "favourites_count": 17,
         "profile_text_color": "D4B020",
         "verified": false,
         "description": "Dad, Innovator, Sales Professional. Project Management Professional (PMP).  Soccer Coach,  Little League Coach  #Agile #PMOT - views are my own -",
         "contributors_enabled": false,
         "name": "Scott Ostby",
         "profile_sidebar_border_color": "404040",
         "profile_background_color": "0F0F0F",
         "created_at": "Tue Aug 02 21:10:39 +0000 2011",
         "default_profile_image": false,
         "followers_count": 19005,
         "profile_image_url_https": "https://si0.twimg.com/profile_images/1928022765/scott_normal.jpg",
         "geo_enabled": true,
         "profile_background_image_url": "http://a0.twimg.com/profile_background_images/327807929/xce5b8c5dfff3dc3bbfbdef5ca2a62b4.jpg",
         "profile_background_image_url_https": "https://si0.twimg.com/profile_background_images/327807929/xce5b8c5dfff3dc3bbfbdef5ca2a62b4.jpg",
         "follow_request_sent": null,
         "url": "http://facebook.com/ostby",
         "utc_offset": -28800,
         "time_zone": "Pacific Time (US & Canada)",
         "notifications": null,
         "friends_count": 13172,
         "profile_use_background_image": true,
         "profile_sidebar_fill_color": "1C1C1C",
         "screen_name": "ScottOstby",
         "id_str": "347471575",
         "profile_image_url": "http://a0.twimg.com/profile_images/1928022765/scott_normal.jpg",
         "show_all_inline_media": true,
         "is_translator": false,
         "listed_count": 45
      },
      "coordinates": null
   },
   "contributors": null,
   "text": "RT @ScottOstby: #Crowdsourcing – drivers already generate traffic data for your smartphone to suggest alternative routes when a road is  ...",
   "geo": null,
   "retweeted": false,
   "in_reply_to_screen_name": null,
   "truncated": false,
   "entities": {
      "urls": [],
      "hashtags": [
         {
            "text": "Crowdsourcing",
            "indices": [
               16,
               30
            ]
         }
      ],
      "user_mentions": [
         {
            "id": 347471575,
            "name": "Scott Ostby",
            "indices": [
               3,
               14
            ],
            "screen_name": "ScottOstby",
            "id_str": "347471575"
         }
      ]
   },
   "in_reply_to_status_id_str": null,
   "id": 245270269525123072,
   "in_reply_to_user_id_str": null,
   "source": "web",
   "favorited": false,
   "in_reply_to_status_id": null,
   "in_reply_to_user_id": null,
   "retweet_count": 0,
   "created_at": "Mon Sep 10 21:19:23 +0000 2012",
   "id_str": "245270269525123072",
   "place": null,
   "user": {
      "location": "",
      "default_profile": true,
      "statuses_count": 1294,
      "profile_background_tile": false,
      "lang": "en",
      "profile_link_color": "0084B4",
      "id": 21804678,
      "following": null,
      "protected": false,
      "favourites_count": 11,
      "profile_text_color": "333333",
      "verified": false,
      "description": "",
      "contributors_enabled": false,
      "name": "Parvez Jugon",
      "profile_sidebar_border_color": "C0DEED",
      "profile_background_color": "C0DEED",
      "created_at": "Tue Feb 24 22:10:43 +0000 2009",
      "default_profile_image": false,
      "followers_count": 70,
      "profile_image_url_https": "https://si0.twimg.com/profile_images/2280737846/ni91dkogtgwp1or5rwp4_normal.gif",
      "geo_enabled": false,
      "profile_background_image_url": "http://a0.twimg.com/images/themes/theme1/bg.png",
      "profile_background_image_url_https": "https://si0.twimg.com/images/themes/theme1/bg.png",
      "follow_request_sent": null,
      "url": null,
      "utc_offset": null,
      "time_zone": null,
      "notifications": null,
      "friends_count": 299,
      "profile_use_background_image": true,
      "profile_sidebar_fill_color": "DDEEF6",
      "screen_name": "ParvezJugon",
      "id_str": "21804678",
      "profile_image_url": "http://a0.twimg.com/profile_images/2280737846/ni91dkogtgwp1or5rwp4_normal.gif",
      "show_all_inline_media": false,
      "is_translator": false,
      "listed_count": 7
   },
   "coordinates": null
}
{% endhighlight %}

It’s fairly easy to see that there is a good bit of complexity to this data structure. Since JSON can contain nested data structures, it becomes very hard to force JSON data into a standard relational schema. Processing JSON data in a relational database would likely require significant transformation, making the job much more cumbersome.

Looking at this particular bit of JSON, there are some very interesting fields: At the very top, there is a retweeted_status object, whose existence indicates that this tweet was retweeted by another user. If the tweet was not a retweet, you would not have a retweeted_status object at all. Tweets also contain an entities element, which is a nested structure. It contains three arrays, the elements of which are all nested structures in their own right, as can be seen in the hashtags array, which has two entries. How do you deal with a record like this in Hive?

## Complex Data Structures

Hive has native support for a set of data structures that normally would either not exist in a relational database, or would require definition of custom types. There are all the usual players: integers, strings, floats, and the like, but the interesting ones are the more exotic [maps, arrays, and structs](https://cwiki.apache.org/confluence/display/Hive/LanguageManual+Types). Maps and arrays work in a fairly intuitive way, similar to how they work in many scripting languages:

{% highlight sql %}
SELECT array_column[0] FROM foo;
SELECT map_column[‘map_key’] FROM foo;
{% endhighlight %}

Structs are a little more complicated, since they are arbitrary structures, and a struct field can be queried much like an instance variable in a Java class:

{% highlight sql %}
SELECT struct_column.struct_field FROM foo;
{% endhighlight %}

To store the data for a tweet, arrays and structs will be crucial. 
 
## A Table for Tweets
 
Here is the table that was designed to store tweets, with some columns omitted:

{% highlight sql %}
CREATE EXTERNAL TABLE tweets (
 ...
 retweeted_status STRUCT<
   text:STRING,
   user:STRUCT>,
 entities STRUCT<
   urls:ARRAY>,
   user_mentions:ARRAY>,
   hashtags:ARRAY>>,
 text STRING,
 ...
)
PARTITIONED BY (datehour INT)
ROW FORMAT SERDE 'com.cloudera.hive.serde.JSONSerDe'
LOCATION '/user/flume/tweets';
{% endhighlight %}

By comparing the JSON objects from the tweet with the columns in the table, we can see how the JSON objects are mapped to Hive columns. Looking at the entities column, we can see what a particularly complex column might look line:

	entities STRUCT<
   		urls:ARRAY>,
   		user_mentions:ARRAY>,
   		hashtags:ARRAY>>

`entities` is a struct which contains three arrays, and each individual array stores elements which are also structs. If we wanted to query the screen names of the first mentioned user from each tweet, we could write a query like this:

{% highlight sql %}
SELECT entities.user_mentions[0].screen_name FROM tweets;
{% endhighlight %}

If the `user_mentions` array is empty, Hive will just return `NULL` for that record.

The `PARTITIONED BY` clause utilizes a feature of Hive called [partitioning](https://cwiki.apache.org/confluence/display/Hive/LanguageManual+DDL#LanguageManualDDL-Partitionedtables), which allows tables to be split up in different directories. By building queries that involve the partitioning column, Hive can determine that certain directories cannot possibly contain results for a query. Partitioning allows Hive to skip the processing of entire directories at query time, which can improve query performance dramatically.

The `LOCATION` clause is a requirement when using [EXTERNAL tables](http://hive.apache.org/docs/r0.9.0/language_manual/data-manipulation-statements.html). By default, data for tables is stored in a directory located at `/user/hive/warehouse/`.

However, EXTERNAL tables can specify an alternate location where the table data resides, which works nicely if Flume is being used to place data in a predetermined location. EXTERNAL tables also differ from regular Hive tables, in that the table data will not be removed if the EXTERNAL table is dropped.

The `ROW FORMAT` clause is the most important one for this table. In simple datasets, the format will likely be `DELIMITED`, and we can specify the characters that terminate fields and records, if the defaults are not appropriate. However, for the tweets table, we’ve specified a `SERDE`.

## Serializers and Deserializers

In Hive, [SerDe](https://cwiki.apache.org/confluence/display/Hive/SerDe) is an abbreviation for Serializer and Deserializer, and is an interface used by Hive to determine how to process a record. Serializers and Deserializers operate in opposite ways. The [Deserializer](http://javasourcecode.org/html/open-source/hive/hive-0.9.0/org/apache/hadoop/hive/serde2/Deserializer.html) interface takes a string or binary representation of a record, and translates it into a Java object that Hive can manipulate. The [Serializer](http://javasourcecode.org/html/open-source/hive/hive-0.9.0/org/apache/hadoop/hive/serde2/Serializer.html), on the other hand, will take a Java object that Hive has been working with, and turn it into something that Hive can write to HDFS. Commonly, Deserializers are used at query time to execute SELECT statements, and Serializers are used when writing data, such as through an INSERT-SELECT statement. In the Twitter analysis example, we wrote a [JSONSerDe](https://github.com/cloudera/cdh-twitter-example/blob/master/hive-serdes/src/main/java/com/cloudera/hive/serde/JSONSerDe.java), which can be used to transform a JSON record into something that Hive can process.

## Putting It All Together

By utilizing the SerDe interface, we can instruct Hive to interpret data according to its inherent structure (or lack thereof). Since a SerDe is just a property of a Hive table, rather than the data, itself, we can also swap out SerDes as our data evolves. That flexibility allows us to choose the right tools for the job at hand, and to interpret data in different ways. It makes Hive a spectacular choice for getting quick access to data of all types.

In [the first post in this series](/hadoop/2014/03/20/analyzing-twitter-data-with-apache-hadoop.html), we saw how we could use Hive to find influential users. Let’s look at some other queries we might want to write.

Geographic distributions of users can be interesting to look at. Unfortunately, the data I got from Twitter does not contain much of the geographic information necessary to plot really precise locations for users, but we can use time zones to get a sense of where in the world the users are. We can ask a question like, “Which time zones are the most active per day?”:

{% highlight sql %}
SELECT
 user.time_zone,
 SUBSTR(created_at, 0, 3),
 COUNT(*) AS total_count
FROM tweets
WHERE user.time_zone IS NOT NULL
GROUP BY
 user.time_zone,
 SUBSTR(created_at, 0, 3)
ORDER BY total_count DESC
LIMIT 15;
  
Results in:
Eastern Time (US & Canada)    Tue    2737
Eastern Time (US & Canada)    Wed    2663
Pacific Time (US & Canada)    Wed    1725
Pacific Time (US & Canada)    Tue    1643
Eastern Time (US & Canada)    Thu    1421
Central Time (US & Canada)    Wed    1376
Central Time (US & Canada)    Tue    1285
London    Wed    1066
London    Tue    1065
Brussels    Wed    920
Brussels    Tue    894
Pacific Time (US & Canada)    Thu    892
London    Thu    824
Brussels    Thu    713
Central Time (US & Canada)    Thu    655
{% endhighlight %}

Interestingly, more users are tweeting about the selected terms on the east coast, than the west coast. Europe also seems to be pretty interested in big data.
We can also formulate more complex queries to ask questions like “Which were the most common hashtags?”:

{% highlight sql %}
SELECT
 LOWER(hashtags.text),
 COUNT(*) AS total_count
FROM tweets
LATERAL VIEW EXPLODE(entities.hashtags) t1 AS hashtags
GROUP BY LOWER(hashtags.text)
ORDER BY total_count DESC
LIMIT 15;
  
Results in:
bigdata    8890
analytics    2965
cloud    1390
job    1090
jobs    876
cloudcomputing    675
cloudexpo    625
seo    522
hadoop    516
data    470
bi    463
nosql    426
marketing    349
ibm    349
tech    272
{% endhighlight %}

Not surprisingly, several of the terms that I searched for when I was collecting data show up here. The first term that shows up, which I didn’t search for, is job, followed by jobs. Cloudera’s hiring, by the way. You may also notice the use of some non-standard SQL constructs, like [LATERAL VIEW and EXPLODE](https://cwiki.apache.org/Hive/languagemanual-lateralview.html). Lateral views are used when using functions like EXPLODE, which may generate more than one row of output for each row of input. 

## One Thing to Watch Out For…

If it looks like a duck, and it sounds like a duck, then it must be a duck, right? For users who are new to Hive, do not mistake Hive for a relational database. Hive looks a lot like a database, and you can interact with it very much like a database, but it should not be treated as such. Any query run in Hive is actually executed as a sequence of MapReduce jobs, which brings with it all of the performance implications of having to start up multiple JVMs. This means that all queries will have to pay a fixed setup cost, which will result in poor performance when running lightweight queries. This fact makes Hive particularly nice for executing batch workloads. Like MapReduce, Hive shines brightest when working with massive data sets. However, it is important to realize that Hive queries may not have a response time that can be considered interactive, and Hive will likely not serve as a replacement for a traditional analytical database.

## Conclusion

In this article we’ve discussed some of the benefits and trade-offs of using Hive, and seen how to build a SerDe to process JSON data, without any preparation of the data. By using the powerful SerDe interface with Hive, we can process data that has a looser structure than would be possible in a relational database. This enables us to query and analyze traditional structured data, as well as semi- and even unstructured data. 

*Jon Natkins ([@nattybnatkins](http://www.twitter.com/nattybnatkins)) is a Software Engineer at Cloudera, where he has worked on Cloudera Manager and Hue, and has contributed to a variety of projects in the Apache Hadoop ecosystem. Prior to Cloudera, Jon wrangled databases at Vertica. He holds an Sc.B in Computer Science from Brown University.*