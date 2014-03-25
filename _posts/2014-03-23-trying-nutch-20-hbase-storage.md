---
layout: post
title: "Trying Nutch 2.0 HBase storage"
category: Nutch
tags: [nutch, nutch2, hbase]
---
## Introduction

It is likely one can run into issues using HBase as datastore for Nutch, especially with a commodity hardware that has very limited memory. This article follows up one posts:

[Exploring Nutch 2.0 HBase Storage](http://localhost:7090/display/Wiki/Exploring+the+Nutch+2.0+HBase+Storage+Backend)

which explain how to setup Nutch 2.0 with HBase.

## Memory Issue

In my case, HBase is running in an environment that consists of a laptop that only has 1 GB of memory. This is too little. When Java forks the process, it duplicates the parent process' pages in order to load memory for the child one. Hence requiring twice as much it was using before the fork.

You can see that the JVM doubles the Java Heap Space size at around 5 PM, which crashes HBase. Keep reading to see what are the errors in the corresponding logs .

## HBase error

First let's take a look at the data Nutch created.

{% highlight bash %}
$ bin/hbase shell 

HBase Shell; enter 'help' for list of supported commands. Version: 0.20.6, r965666, Mon Jul 19 16:54:48 PDT 2010 hbase(main):001:0> list webpage 1 row(s) in 0.1480 seconds 

hbase(main):002:0> describe 

"webpage" { NAME => 'webpage', FAMILIES => [ {NAME => 'f', COMPRESSION => 'NONE', VERSIONS => '3', TTL => '2147483647', BLOCKSIZE => '65536', IN_MEMORY => 'false', 
BLOCKCACHE => 'true'}, {NAME => 'h', COMPRESSION => 'NONE', VERSIONS => '3', TTL => '2147483647', BLOCKSIZE => '65536', IN_MEMORY => 'false', BLOCKCACHE => 'true'}, {NAME =>
 'il', COMPRESSION => 'NONE', VERSIONS => '3', TTL => '2147483647', BLOCKSIZE => '65536', IN_MEMORY => 'false', BLOCKCACHE => 'true'}, {NAME => 'mk', COMPRESSION => 'NONE',
  VERSIONS => '3', TTL => '2147483647', BLOCKSIZE => '65536', IN_MEMORY => 'false', BLOCKCACHE => 'true'}, {NAME => 'mtdt', COMPRESSION => 'NONE', VERSIONS => '3', TTL => 
  '2147483647', BLOCKSIZE => '65536', IN_MEMORY => 'false', BLOCKCACHE => 'true'}, {NAME => 'ol', COMPRESSION => 'NONE', VERSIONS => '3', TTL => '2147483647', BLOCKSIZE =>
   '65536', IN_MEMORY => 'false', BLOCKCACHE => 'true'}, {NAME => 'p', COMPRESSION => 'NONE', VERSIONS => '3', TTL => '2147483647', BLOCKSIZE => '65536', IN_MEMORY =>
    'false', BLOCKCACHE => 'true'}, {NAME => 's', COMPRESSION => 'NONE', VERSIONS => '3', TTL => '2147483647', BLOCKSIZE => '65536', IN_MEMORY => 'false', BLOCKCACHE => 
    'true'} ] } hbase(main):003:0> scan "webpage", { LIMIT => 1 } ROW COLUMN+CELL com.richkidzradio:http/ column=f:bas, timestamp=1295012635817, value=http://richkidzradio.
    com/ ...
{% endhighlight %}

I had issues with the updatedb command on 200k rows after parsing around 20k rows. When the fork happened, the logs in `$HBASE_HOME/logs/hbase-alex-master-maison.log` show:

{% highlight bash %}
2011-01-18 16:59:16,685 DEBUG org.apache.hadoop.hbase.regionserver.HRegion: Flush requested on webpage,com.richkidzradio:http/,1295020425887 
2011-01-18 16:59:16,685 DEBUG org.apache.hadoop.hbase.regionserver.HRegion: Started memstore flush for region webpage,com.richkidzradio:http/,1295020425887. Current region memstore size 64.0m 
2011-01-18 16:59:16,686 DEBUG org.apache.hadoop.hbase.regionserver.HRegion: Finished snapshotting, commencing flushing stores 
2011-01-18 16:59:16,728 FATAL org.apache.hadoop.hbase.regionserver.MemStoreFlusher: Replay of hlog required. Forcing server shutdown org.apache.hadoop.hbase.DroppedSnapshotException: region: webpage,com.richkidzradio:http/,1295020425887 
at org.apache.hadoop.hbase.regionserver.HRegion.internalFlushcache(HRegion.java:1041) 
at org.apache.hadoop.hbase.regionserver.HRegion.flushcache(HRegion.java:896) 
at org.apache.hadoop.hbase.regionserver.MemStoreFlusher.flushRegion(MemStoreFlusher.java:258) 
at org.apache.hadoop.hbase.regionserver.MemStoreFlusher.flushRegion(MemStoreFlusher.java:231) 
at org.apache.hadoop.hbase.regionserver.MemStoreFlusher.run(MemStoreFlusher.java:154) 
Caused by: java.io.IOException: Cannot run program "chmod": java.io.IOException: error=12, 
Cannot allocate memory at java.lang.ProcessBuilder.start(ProcessBuilder.java:460) 
at org.apache.hadoop.util.Shell.runCommand(Shell.java:149) 
at org.apache.hadoop.util.Shell.run(Shell.java:134) 
at org.apache.hadoop.util.Shell$ShellCommandExecutor.execute(Shell.java:286) 
at org.apache.hadoop.util.Shell.execCommand(Shell.java:354) 
at org.apache.hadoop.util.Shell.execCommand(Shell.java:337) 
at org.apache.hadoop.fs.RawLocalFileSystem.execCommand(RawLocalFileSystem.java:481) 
at org.apache.hadoop.fs.RawLocalFileSystem.setPermission(RawLocalFileSystem.java:473) 
at org.apache.hadoop.fs.FilterFileSystem.setPermission(FilterFileSystem.java:280) 
at org.apache.hadoop.fs.ChecksumFileSystem.create(ChecksumFileSystem.java:372) 
at org.apache.hadoop.fs.FileSystem.create(FileSystem.java:484) 
at org.apache.hadoop.fs.FileSystem.create(FileSystem.java:465) 
at org.apache.hadoop.fs.FileSystem.create(FileSystem.java:372) 
at org.apache.hadoop.fs.FileSystem.create(FileSystem.java:364) 
at org.apache.hadoop.hbase.io.hfile.HFile$Writer.<init>(HFile.java:296) 
at org.apache.hadoop.hbase.regionserver.StoreFile.getWriter(StoreFile.java:393) 
at org.apache.hadoop.hbase.regionserver.Store.getWriter(Store.java:585) 
at org.apache.hadoop.hbase.regionserver.Store.getWriter(Store.java:576) 
at org.apache.hadoop.hbase.regionserver.Store.internalFlushCache(Store.java:540) 
at org.apache.hadoop.hbase.regionserver.Store.flushCache(Store.java:516) 
at org.apache.hadoop.hbase.regionserver.Store.access$100(Store.java:88) 
at org.apache.hadoop.hbase.regionserver.Store$StoreFlusherImpl.flushCache(Store.java:1597) 
at org.apache.hadoop.hbase.regionserver.HRegion.internalFlushcache(HRegion.java:1000) ... 
4 more Caused by: java.io.IOException: java.io.IOException: error=12, Cannot allocate memory at java.lang.UNIXProcess.<init>(UNIXProcess.java:148) 
at java.lang.ProcessImpl.start(ProcessImpl.java:65) 
at java.lang.ProcessBuilder.start(ProcessBuilder.java:453) ... 
26 more 2011-01-18 16:59:16,730 DEBUG org.apache.hadoop.hbase.regionserver.HRegion: Flush requested on webpage,com.richkidzradio:http/,1295020425887 
2011-01-18 16:59:16,758 INFO org.apache.hadoop.ipc.HBaseServer: IPC Server handler 11 on 34511, 
call put([B@24297, [Lorg.apache.hadoop.hbase.client.Put;@61f9c6) from 0:0:0:0:0:0:0:1:38369: 
error: java.io.IOException: Server not running, aborting java.io.IOException: 
Server not running, aborting at org.apache.hadoop.hbase.regionserver.HRegionServer.checkOpen(HRegionServer.java:2307) 
at org.apache.hadoop.hbase.regionserver.HRegionServer.put(HRegionServer.java:1773) 
at sun.reflect.GeneratedMethodAccessor46.invoke(Unknown Source) 
at sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:25) 
at java.lang.reflect.Method.invoke(Method.java:597) at org.apache.hadoop.hbase.ipc.HBaseRPC$Server.call(HBaseRPC.java:657) 
at org.apache.hadoop.hbase.ipc.HBaseServer$Handler.run(HBaseServer.java:915) 
2011-01-18 16:59:16,759 INFO org.apache.hadoop.hbase.regionserver.HRegionServer: Dump of metrics: request=0.0, regions=7, stores=43, storefiles=42, storefileIndexSize=0, memstoreSize=129, compactionQueueSize=0, usedHeap=317, maxHeap=996, blockCacheSize=175238616, blockCacheFree=33808120, blockCacheCount=2196, blockCacheHitRatio=88, fsReadLatency=0, fsWriteLatency=0, fsSyncLatency=0 
2011-01-18 16:59:16,759 INFO org.apache.hadoop.hbase.regionserver.MemStoreFlusher: RegionServer:0.cacheFlusher exiting 
2011-01-18 16:59:16,944 INFO org.apache.hadoop.ipc.HBaseServer: Stopping server on 34511
{% endhighlight %}

The exception occurs when HBase was trying to update the first row from the batch. The class that forks the process is org.apache.hadoop.fs.RawLocalFileSystem. It's actually a hadoop related issue, reported in [HADOOP-5059](https://issues.apache.org/jira/browse/HADOOP-5059).

Here are the versions being used:

* HBase 0.20.6
* lib/hadoop-0.20.2-core.jar

## Recover HBase

Running Nutch updatedb command again, you might see an error in the Nutch logs:

{% highlight bash %}
org.apache.hadoop.hbase.client.RetriesExhaustedException: Trying to contact region server Some server, retryOnlyOne=true, index=0, islastrow=true, tries=9, numtries=10, i=0, listsize=1, region=webpage,com.richkidzradio:http/,1295020425887 for region webpage,com.richkidzradio:http/,1295020425887, row 'hf:http/', but failed after 10 attempts. 
Exceptions: at org.apache.hadoop.hbase.client.HConnectionManager$TableServers$Batch.process(HConnectionManager.java:1157) 
at org.apache.hadoop.hbase.client.HConnectionManager$TableServers.processBatchOfRows(HConnectionManager.java:1238) 
at org.apache.hadoop.hbase.client.HTable.flushCommits(HTable.java:666) 
at org.apache.hadoop.hbase.client.HTable.put(HTable.java:510) 
at org.apache.gora.hbase.store.HBaseStore.put(HBaseStore.java:245) 
at org.apache.gora.mapreduce.GoraRecordWriter.write(GoraRecordWriter.java:70) 
at org.apache.hadoop.mapred.ReduceTask$NewTrackingRecordWriter.write(ReduceTask.java:508) 
at org.apache.hadoop.mapreduce.TaskInputOutputContext.write(TaskInputOutputContext.java:80) 
at org.apache.nutch.crawl.DbUpdateReducer.reduce(DbUpdateReducer.java:164) 
at org.apache.nutch.crawl.DbUpdateReducer.reduce(DbUpdateReducer.java:23) 
at org.apache.hadoop.mapreduce.Reducer.run(Reducer.java:176) 
at org.apache.hadoop.mapred.ReduceTask.runNewReducer(ReduceTask.java:566) 
at org.apache.hadoop.mapred.ReduceTask.run(ReduceTask.java:408) 
at org.apache.hadoop.mapred.LocalJobRunner$Job.run(LocalJobRunner.java:216)
{% endhighlight %}

and in the HBase logs

{% highlight bash %}
2011-01-18 15:56:11,195 DEBUG org.apache.hadoop.hbase.regionserver.HRegionServer: Batch puts interrupted at index=0 because:Requested row out of range for HRegion webpage,com.richkidzradio:http/,1295020425887, startKey='com.richkidzradio:http/', getEndKey()='es.plus.www:http/', row='hf:http/'
{% endhighlight %}

As mentioned here, you might have "holes". You want to specify to add_table.rb script the webpage table directory to fix the problem

{% highlight bash %}
$ cd $HBASE_HOME/bin
$ stop-hbase.sh
$ start-hbase.sh
$ ./hbase org.jruby.Main add_table.rb /home/alex/hbase/hbase-alex/hbase/webpage
{% endhighlight %}

## Conclusion

To fix this issue, check out this new post, [Increase your Swap size](http://techvineyard.blogspot.com/2011/02/increase-your-swap-partition.html). With the current versions of Hadoop and HBase, very limited RAM and insufficient Swap, you will not go very far, due to silly fork operations. Maybe with the new version of Hadoop, the 0.22 yet to be released, as well as 0.90 for HBase, these issues will be fixed. I guess it's now time to give it a try to Cassandra...
