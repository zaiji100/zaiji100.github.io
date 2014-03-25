---
layout: post
title: "Analyzing Twitter Data with Apache Hadoop, Part 2"
description: "Gathering Data with Flume"
category: Hadoop
tags: [twitter, hadoop, analyzing data, flume]
---

## Sources

source是Flume里连接数据源的组件，是数据在Flume数据流流转的起点。Source处理事件，并将它们发送给一个channel。Sources通过收集不连续的数据，并将数据转换为独立的事件，然后使用channel处理事件，可以一次处理一个事件，也可以作为一个batch处理一次处理一批事件。

Flume有两种类型的sources，事件驱动的和可拉取的。事件驱动和可拉取之间的不同在于事件如何生成和处理。事件驱动源通过回调的机制接收事件。与此相反，可拉取的源循环去读取事件。另外一种区分这两种sources的方式是｀PUSH V.S. PULL｀模型，事件驱动sources是事件推送给sources；可拉取sources是从一个generator中拉取事件。

## 检查TwitterSource {#check-twitter-source}

在前面例子中，我们建立一个叫做TwitterSource的自定义source。为了更深刻的理解source如何运作，让我们看一下如何构建TwitterSource。我们先建立一个TwitterSource的样本文件

{% highlight java %}
/**
 * A template for a custom, configurable Flume source
 */
public class BoilerplateCustomFlumeSource extends AbstractSource
    implements EventDrivenSource, Configurable {
  
  /**
   * The initialization method for the Source. The context contains all the
   * Flume configuration info, and can be used to retrieve any configuration
   * values necessary to set up the Source.
   */
  @Override
  public void configure(Context context) {
    // Get config params with context.get* methods
    // Example: stringParam = context.getString("stringParamName")
  }
  
  /**
   * Start any dependent systems and begin processing events.
   */
  @Override
  public void start() {
    // For an event-driven source, the start method should spawn
    // a thread that will receive events and forward them to the
    // channel
    super.start();
  }
  
  /**
   * Stop processing events and shut any dependent systems down.
   */
  @Override
  public void stop() {
    super.stop();
  }
}
{% endhighlight %}

这样我们就有了一个可配置的source，并且可以将它安装到Flume，尽管现在并不做任何操作。
 
start()方法包含了大部分source的逻辑。在TwitterSource中，[twitter4j](http://twitter4j.org/)库使用下面代码来访问Twitter Streaming API

{% highlight java %}
// The StatusListener is a twitter4j API, which can be added to a Twitter
// stream, and will execute callback methods every time a message comes in
// through the stream.
StatusListener listener = new StatusListener() {
  // The onStatus method is a callback executed when a new tweet comes in.
  public void onStatus(Status status) {
    Map headers = new HashMap();
    // The EventBuilder is used to build an event using the headers and
    // the raw JSON of a tweet
    headers.put("timestamp", String.valueOf(status.getCreatedAt().getTime()));
    Event event = EventBuilder.withBody(
        DataObjectFactory.getRawJSON(status).getBytes(), headers);
  
    try {
      getChannelProcessor().processEvent(event);
    } catch (ChannelException e) {
      // If we catch a channel exception, it’s likely that the memory channel
      // does not have a high enough capacity for our rate of throughput, and
      // we tried to put too many events in the channel. Error handling or
      // retry logic would go here.
      throw e;
    }
  }
         
  // This listener will ignore everything except for new tweets
  public void onDeletionNotice(StatusDeletionNotice statusDeletionNotice) {}
  public void onTrackLimitationNotice(int numberOfLimitedStatuses) {}
  public void onScrubGeo(long userId, long upToStatusId) {}
  public void onException(Exception ex) {}
};
{% endhighlight %}

StatusListener实现了一系列回调方法，这些回调方法在收到一个新tweet时被调用，tweet用Status对象表示。StatusListener还有其它回调方法，但是本例中我们只关心新tweets。在TwitterSource中我们可以看到，StatusListener在start()方法中被创建和注册。
 
再进一步观察，我可以看到为tweet建立一个事件：

{% highlight java %}
headers.put("timestamp", String.valueOf(status.getCreatedAt().getTime()));
Event event = EventBuilder.withBody(
      DataObjectFactory.getRawJSON(status).getBytes(), headers));
{% endhighlight %}

EventBuilder接口接收一个字节数组和一个可选的headers集合作为参数，创建一个事件，并将该事件放在一个list的末尾。Source处理events并将它们传递给channel。

{% highlight java %}
channel.processEvent(event);
{% endhighlight %}

为了连接Twitter API，我们需要访问一些应用级别的敏感信息。在TwitterSource中我们用到了consumerKey和consumerSecret变量。

{% highlight java %}
twitterStream.setOAuthConsumer(consumerKey, consumerSecret);
{% endhighlight %}

consumerKey和consumerSecret在哪儿定义呢？这里，这两个变量为配置参数，查看一下configure()方法，我们可以看到这两个变量的定义。

{% highlight java %}
consumerKey = context.getString(TwitterSourceConstants.CONSUMER_KEY_KEY);
consumerSecret = context.getString(TwitterSourceConstants.CONSUMER_SECRET_KEY);
{% endhighlight %}

context对象包含所有source的配置参数，它们可以用一系列get方法访问到。

这样，自定义source能够将tweets作为事件来处理。下一步将定义这些事件应该流向到哪里，和它们如何到达那里。

## 配置Flume Agent {#config-flume-agent}

在我们讨论如何实际配置一个Flume的agent之前，我们需要知道一个完整的配置的形式。这个例子中我们使用[该配置](https://github.com/cloudera/cdh-twitter-example/blob/master/flume-sources/flume.conf)

{% highlight java %}
TwitterAgent.sources = Twitter
TwitterAgent.channels = MemChannel
TwitterAgent.sinks = HDFS
  
TwitterAgent.sources.Twitter.type = com.cloudera.flume.source.TwitterSource
TwitterAgent.sources.Twitter.channels = MemChannel
TwitterAgent.sources.Twitter.consumerKey = [required]
TwitterAgent.sources.Twitter.consumerSecret = [required]
TwitterAgent.sources.Twitter.accessToken = [required]
TwitterAgent.sources.Twitter.accessTokenSecret = [required]
TwitterAgent.sources.Twitter.keywords = hadoop, big data, analytics, bigdata, cloudera, data science, data scientist, business intelligence, mapreduce, data warehouse, data warehousing, mahout, hbase, nosql, newsql, businessintelligence, cloudcomputing
  
TwitterAgent.sinks.HDFS.channel = MemChannel
TwitterAgent.sinks.HDFS.type = hdfs
TwitterAgent.sinks.HDFS.hdfs.path = hdfs://hadoop1:8020/user/flume/tweets/%Y/%m/%d/%H/
TwitterAgent.sinks.HDFS.hdfs.fileType = DataStream
TwitterAgent.sinks.HDFS.hdfs.writeFormat = Text
TwitterAgent.sinks.HDFS.hdfs.batchSize = 1000
TwitterAgent.sinks.HDFS.hdfs.rollSize = 0
TwitterAgent.sinks.HDFS.hdfs.rollCount = 10000
TwitterAgent.sinks.HDFS.hdfs.rollInterval = 600
  
TwitterAgent.channels.MemChannel.type = memory
TwitterAgent.channels.MemChannel.capacity = 10000
TwitterAgent.channels.MemChannel.transactionCapacity = 100
{% endhighlight %}

每一个定义的对象会被其他配置引用。大多数Flume配置项的格式和logj的appenders相似。一个配置项形式如下

	[agent_name].[object_type].[object_name].[parameter_name]   // [object_type]是sources，channels或者sinks其中之一

## Channels

Channels是连接sources和sinks的一条路径，Events由sources添加到channels，然后由sinks从channels中删除。Flume数据流实际上支持多channels，这样可以组成更复杂的数据流，例如为了复制，形成一个像扇形的数据流。

在本例中，我们使用了一个内存channel

TwitterAgent.channels.MemChannel.type = memory

内存channel使用一个内存中的队列来存储事件直到它们准备好被写到一个sink。内存channel在数据流吞吐量较高时比较有用；然而，由于events存储在内存，当agent出现错误时，它们会丢失。如果数据丢失的风险不能被容忍，可以使用其他类型的channel，例如FileChannel。

## Sinks

Flume数据流最后一步是sink。Sinks获取events，并将他们发送给配置好的位置，或转发给另外一个agent。在本例中我们使用了HDFS sink，它将事件存储到HDFS的一个指定位置。

我们使用的HDFS sink配置做了许多事情：首先，它用rollCount参数定义了文件大小，这样每个文件将包含10,000条tweets。它也通过设置fileType为DataStream和writeFormat为Text保持了原始数据格式，而不是将数据存储为SequenceFile或其他格式。最有趣的一点，是存储路径参数。

	TwitterAgent.sinks.HDFS.hdfs.path = hdfs://hadoop1:8020/user/flume/tweets/%Y/%m/%d/%H/

文件路径使用一些通配符来使文件存放到一系列表示事件发生的年，月，日，时的文件夹中。例如，一个事件在9/20/2012 3:00PM到达，它将存放在<hdfs://hadoop1:8020/user/flume/tweets/2012/09/20/15>。

时间戳信息来自于哪里？如果你回顾一下，我们在TwitterSource中为每一个事件添加了一个header：

{% highlight java %}
headers.put("timestamp", String.valueOf(status.getCreatedAt().getTime()));
{% endhighlight %}

时间戳被用来确定事件的时间戳，并被用来确定事件存放的路径。

## 运行Agent {#run-flume-agent}

现在我们理解了我们source，channel和sink的配置，我们需要运行agent来运行数据流。在我们实际启动agent前，我们需要为agent设置一个合适的名字。
 
/etc/default/flume-ng-agent文件包含了一个叫做FLUME_AGENT_NAME环境变量。在一个生产系统中，为了简化，FLUME_AGENT_NAME可以设置为运行agent的机器的hostname。在本例中，我们设置它为TwitterAgent。
 
我们可以用以下命令运行agent

{% highlight bash %}
$ /etc/init.d/flume-ng-agent start
{% endhighlight %}

当它运行时，我们可以看到/user/flume/tweets目录下会出现一些文件

{% highlight bash %}
natty@hadoop1:~/source/cdh-twitter-example$ hadoop fs -ls /user/flume/tweets/2012/09/20/05
  Found 2 items
  -rw-r--r--   3 flume hadoop   255070 2012-09-20 05:30 /user/flume/tweets/2012/09/20/05/FlumeData.1348143893253
  -rw-r--r--   3 flume hadoop   538616 2012-09-20 05:39 /user/flume/tweets/2012/09/20/05/FlumeData.1348143893254.tmp
{% endhighlight %}

在更多的事件处理后，Flume将文件写到对应的文件夹中。临时文件的后缀名为.tmp,是当前正在写的文件。当Flume确定文件包含了足够的events，或足够的时间来切换文件时，.tmp后缀将被移除。这由HDFS sink中的配置确定，我们在上面已经有所介绍，rollCount和rollInterval参数

原文地址

[Analyzing Twitter Data with Apache Hadoop, Part 2: Gathering Data with Flume](http://blog.cloudera.com/blog/2012/10/analyzing-twitter-data-with-hadoop-part-2-gathering-data-with-flume/)

[下一章](/hadoop/2014/03/20/analyzing-twitter-data-with-apache-hadoop-part-3.html)介绍使用Hive查询HDFS数据