---
layout: post
title: "SegmentReader Nutch"
category: Nutch
tags: [hadoop, nutch, generate, map-reduce]
---
前面我们看了一下Generate的流程，它是为Fetch产生相应的fetchlist，这里想介绍一下Segment的查看工具SegmentReader类。

## 1. 命令介绍 {#introduce}

{% highlight bash %}
$ bin/nutch readseg
Usage: SegmentReader (-dump ... | -list ... | -get ...) [general options]
{% endhighlight %}

<div class="bs-callout bs-callout-info">
	<p>General options:</p>
    <p>-nocontent ignore content directory</p> 
    <p>-nofetch ignore crawl_fetch directory </p>
    <p>-nogenerate ignore crawl_generate directory </p>
    <p>-noparse ignore crawl_parse directory </p>
    <p>-noparsedata ignore parse_data directory </p>
    <p>-noparsetext ignore parse_text directory</p>
</div>

---

这里用于下载segment的内容，把其转换成文本格式，后面可以加General options参数，看是不是过滤相应的目录

{% highlight bash %}
SegmentReader -dump <segment_dir> <output> [general options]
    Dumps content of a <segment_dir> as a text file to <output>.
   
   
<segment_dir> name of the segment directory.
<output> name of the (non-existent) output directory.
{% endhighlight %}

---

列出相应的segment信息

{% highlight bash %}
SegmentReader -list (<segment_dir1> ... | -dir <segments>) [general options]
List a synopsis of segments in specified directories, or all segments in
a directory <segments>, and print it on System.out
   
   
<segment_dir1> ... list of segment directories to process
-dir <segments> directory that contains multiple segments
{% endhighlight %}


---

得到相对应的url的信息

{% highlight bash %}
SegmentReader -get <segment_dir> <keyValue> [general options]
Get a specified record from a segment, and print it on System.out.
   
   
<segment_dir> name of the segment directory.
<keyValue> value of the key (url).
          Note: put double-quotes around strings with spaces.
{% endhighlight %}

## 2. 导出segments {#dump-to-file}

{% highlight bash %}
$ bin/nutch readseg -dump
{% endhighlight %}

在本地运行其命令的结果如下：

{% highlight bash %}
$ bin/nutch readseg -dump db/segments/20110822105243/ output
    SegmentReader: dump segment: db/segments/20110822105243
    SegmentReader: done
{% endhighlight %}

下载目录浏览

{% highlight bash %}
$ ls output
    dump
{% endhighlight %}

输出一部分下载信息

{% highlight bash %}
$ head output/dump
    Recno:: 0
    URL:: http://baike.baidu.com/
    CrawlDatum::
    Version: 7
    Status: 67 (linked)
    Fetch time: Mon Aug 22 10:58:21 EDT 2011
    Modified time: Wed Dec 31 19:00:00 EST 1969
    Retries since fetch: 0
{% endhighlight %}

我们来看一下其源代码是怎么写的，这个shell命令最终是调用org.apache.nutch.segment.SegmentReader中的dump方法，如下是这个方法的主要源代码：

{% highlight java %}
// 这里生成一个MP任务
JobConf job = createJobConf();
job.setJobName("read " + segment);                         // 查看General Options的参数，是否过滤相应的目录
if (ge) FileInputFormat.addInputPath(job, new Path(segment, CrawlDatum.GENERATE_DIR_NAME));
if (fe) FileInputFormat.addInputPath(job, new Path(segment, CrawlDatum.FETCH_DIR_NAME));
if (pa) FileInputFormat.addInputPath(job, new Path(segment, CrawlDatum.PARSE_DIR_NAME));
if (co) FileInputFormat.addInputPath(job, new Path(segment, Content.DIR_NAME));
if (pd) FileInputFormat.addInputPath(job, new Path(segment, ParseData.DIR_NAME));
if (pt) FileInputFormat.addInputPath(job, new Path(segment, ParseText.DIR_NAME)); // 输入的目录文件格式，这里是SequenceFileInputFormat
job.setInputFormat(SequenceFileInputFormat.class); // 相应的Map与Reducer操作
job.setMapperClass(InputCompatMapper.class);                                      // 这里主要是把key转成UTF8格式，
job.setReducerClass(SegmentReader.class); // 把相应的value对象反序列化成Text类型
Path tempDir = new Path(job.get("hadoop.tmp.dir", "/tmp") + "/segread-" + new java.util.Random().nextInt());
fs.delete(tempDir, true);
   
FileOutputFormat.setOutputPath(job, tempDir);                              // 输出目录
job.setOutputFormat(TextOutputFormat.class);   // output text
job.setOutputKeyClass(Text.class);
job.setOutputValueClass(NutchWritable.class);  // 输出的value类型，这里要注意一下，因为上面Reducer是SegmentReader，
                                               // 其输出的<key,value>类型为<Text,Text>,而这里的value类型为NutchWritable，这里使用了强制类型转换。不知道这么做是为什么？
JobClient.runJob(job);
// concatenate the output
Path dumpFile = new Path(output, job.get("segment.dump.dir", "dump"));
// remove the old file
fs.delete(dumpFile, true);
FileStatus[] fstats = fs.listStatus(tempDir, HadoopFSUtil.getPassAllFilter());
Path[] files = HadoopFSUtil.getPaths(fstats);
PrintWriter writer = null;
int currentRecordNumber = 0;
// 这里主要是合并上面的临时文件到正式的目录文件中output/dump
// 并且加一些格式信息，使用append方法
if (files.length > 0) {
    // create print writer with format
    writer = new PrintWriter(new BufferedWriter(new OutputStreamWriter(fs.create(dumpFile))));
    try {
        for (int i = 0; i < files.length; i++) {                    // read tmp files
            Path partFile = (Path) files[i];
            try {
                currentRecordNumber = append(fs, job, partFile, writer, currentRecordNumber);
            } catch (IOException exception) {
                if (LOG.isWarnEnabled()) {
                    LOG.warn("Couldn't copy the content of " + partFile.toString() + " into " + dumpFile.toString());
                    LOG.warn(exception.getMessage());
                }
            }
        }
    } finally {
        writer.close();
    }
}
fs.delete(tempDir); // 删除临时目录
if (LOG.isInfoEnabled()) { LOG.info("SegmentReader: done"); }
{% endhighlight %}

## 3. 列出相应的segment信息 {#list-segment-infos}

{% highlight bash %}
$ bin/nutch readseg -list
{% endhighlight %}

在本地的运行结果如下：

### 列出单个Segment的信息

{% highlight bash %}
$ bin/nutch readseg -list db/segments/20110822105243/
   
NAME           GENERATED FETCHER START         FETCHER END           FETCHED  PARSED
20110822105243    1       2011-08-22T10:56:09   2011-08-22T10:56:09   1        1
{% endhighlight %}

### 列出多个Segment的信息

{% highlight bash %}
$ bin/nutch readseg -list -dir db/segments/
NAME             GENERATED FETCHER START          FETCHER END            FETCHED  PARSED
20110822105243    1         2011-08-22T10:56:09    2011-08-22T10:56:09    1        1
20110825112318    9         ?                      ?                      ?        ?
20110825112320    10        ?                      ?                      ?        ?
{% endhighlight %}

下面来看一下其源代码，调用的是SegmentReader中的list方法，主要代码如下：

  这个list方法调用了另外一个getStats方法，得到单个Segment的信息

{% highlight java %}
// 得到一个文件的读取器
SequenceFile.Reader[] readers = SequenceFileOutputFormat.getReaders(getConf(), new Path(segment, CrawlDatum.GENERATE_DIR_NAME));
long cnt = 0L;
Text key = new Text();                         // 计算这个Segment有多少url
for (int i = 0; i < readers.length; i++) {
    while (readers[i].next(key)) cnt++;
        readers[i].close();
    }
    stats.generated = cut;                     // get generated url count(cnt)
   
// parse fetch dir  解析fetch目录，计算Fetch的开始与结束时间和fetch网页个数
// 主要这里的fetch目录的文件格式为MapFileOutputFormat
Path fetchDir = new Path(segment, CrawlDatum.FETCH_DIR_NAME);
if (fs.exists(fetchDir) && fs.getFileStatus(fetchDir).isDir()) {
    cnt = 0L;
    long start = Long.MAX_VALUE;
    long end = Long.MIN_VALUE;
    CrawlDatum value = new CrawlDatum();
    MapFile.Reader[] mreaders = MapFileOutputFormat.getReaders(fs, fetchDir, getConf());
    for (int i = 0; i < mreaders.length; i++) {
        while (mreaders[i].next(key, value)) {
            cnt++;
            if (value.getFetchTime() < start) start = value.getFetchTime();
            if (value.getFetchTime() > end) end = value.getFetchTime();
        }
        mreaders[i].close();
    }
    stats.start = start;
    stats.end = end;
    stats.fetched = cnt;
}
   
// parse parsed dir 解析parsed目录，得到解析成功与出错的网页个数
Path parseDir = new Path(segment, ParseData.DIR_NAME);
if (fs.exists(fetchDir) && fs.getFileStatus(fetchDir).isDir()) {
    cnt = 0L;
    long errors = 0L;
    ParseData value = new ParseData();
    MapFile.Reader[] mreaders = MapFileOutputFormat.getReaders(fs, parseDir, getConf());
    for (int i = 0; i < mreaders.length; i++) {
        while (mreaders[i].next(key, value)) {
            cnt++;
            if (!value.getStatus().isSuccess()) errors++;
        }
        mreaders[i].close();
    }
    stats.parsed = cnt;
    stats.parseErrors = errors;
}
{% endhighlight %}

## 4. 得到相对应的url的信息 {#retrieve-url-info}

{% highlight bash %}
bin/nutch readseg -get
{% endhighlight %}

本机运行结果

{% highlight bash %}
$ bin/nutch readseg -get db/segments/20110822105243/ http://hi.baidu.com/
    SegmentReader: get 'http://hi.baidu.com/'
    Crawl Parse:: Version: 7
    Status: 67 (linked)
    Fetch time: Mon Aug 22 10:58:21 EDT 2011
    Modified time: Wed Dec 31 19:00:00 EST 1969
    Retries since fetch: 0
    Retry interval: 2592000 seconds (30 days)
    Score: 0.045454547
    Signature: null
    Metadata:


{% endhighlight %}

下面我们来看一下它的源代码，它是调用SegmentReader中的get方法，主要代码如下：


{% highlight java %}
public void get(final Path segment, final Text key, Writer writer, final Map<String, List<Writable>> results) throws Exception {
    LOG.info("SegmentReader: get '" + key + "'"); // 这里使用的inner class来实现对于不同目录的异步读取
    ArrayList<Thread> threads = new ArrayList<Thread>();
    if (co) threads.add(new Thread() {
        public void run() {
            try { // 从MapFileOutputFormat格式的文件中找到相应的key的value值
                List<Writable> res = getMapRecords(new Path(segment, Content.DIR_NAME), key); 
                // NOTE:有没有注意到这个results是一个HashMap，而在Java中这个HashMap不是线程安全的
                // 在极端的情况下，会出现多个线程同时put数据，这里是不是应该把result改成线程安全的
                // 如 Map result = Collections.synchronizedMap(new HashMap(...));
                results.put("co", res);
            } catch (Exception e) {
                e.printStackTrace(LogUtil.getWarnStream(LOG));
            }
        }
    });]
    .....
    if (pt) threads.add(new Thread() {
        public void run() {
            try {
                List<Writable> res = getMapRecords(new Path(segment, ParseText.DIR_NAME), key);
                results.put("pt", res);
            } catch (Exception e) {
                e.printStackTrace(LogUtil.getWarnStream(LOG));
            }
        }
    });
    Iterator<Thread> it = threads.iterator();
    while (it.hasNext()) it.next().start(); // 运行所有线程
        int cnt; // 这里用一个循环还查看线程是否运行结束
        do {
            cnt = 0;
            try {
                Thread.sleep(5000);
            } catch (Exception e) {};
            it = threads.iterator();
            while (it.hasNext()) {
                if (it.next().isAlive()) cnt++;
            }
            if ((cnt > 0) && (LOG.isDebugEnabled())) {
                LOG.debug("(" + cnt + " to retrieve)");
            }
        } while (cnt > 0); // 把收集的结果输出到终端
        for (int i = 0; i < keys.length; i++) {
            List<Writable> res = results.get(keys[i][0]);
            if (res != null && res.size() > 0) {
                for (int k = 0; k < res.size(); k++) {
                    writer.write(keys[i][1]);
                    writer.write(res.get(k) + "\n");
                }
            }
            writer.flush();
        }
    }
}
{% endhighlight %}

## 5. 总结

这里大概介绍了一下bin/nutch readseg的使用，主要是来查看前面generate和后面的fetch,parse的结束是否有问题。