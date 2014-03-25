---
layout: post
title: "Generate - Nutch"
category: Nutch
tags: [hadoop, nutch, generate, map-reduce]
---
## 1. Generate的作用 {#what-is-generate}

在Inject之后就是Generate，这个方法主要是从CrawlDb中产生一个Fetch可以抓取的url集合(fetchlist)，再结合一定的过滤条件

## 2. 运行Generate命令 {#generate-command}

{% highlight bash %}
$ bin/nutch generate
Usage: Generator <crawldb> <segments_dir> [-force] [-topN N] [-numFetchers numFetchers] [-adddays numDays] [-noFilter] [-noNorm] [-maxNumSegments num]
{% endhighlight %}

参数说明：

* crawldb: crawldb的相对路径
* segments: segments的相对路径
* force:  这个主要是对目录进行加锁用的配置，如果为true，当目标锁文件存在的，会认为是有效的，但如果为false,当目标文件存在时，就就会抛出IOException
* topN: 这里表示产生TopN个url
* numFetchers: 这里是指Generate的MP任务要几个Reducer节点，也就是要几个输出文件，这个配置会影响到Fetcher的Map个数。
* numDays: 这里是表示当前的日期，是在对url过滤中用到的
* noFilter: 这里表示是否对url进行过滤
* noNorm: 这里表示是否以url进行规格化
* maxNumSegments: 这里表示segment的最大个数

这Nutch 1.3 版本中，支持在一次Generate为多个segment产生相应的fetchlists，而IP地址的解析只针对那些准备被抓取的url，在一个segment中，所有url都以IP,domain或者host来分类。

## 3. Generate源代码分析 {#the-source-of-generating}

generate可能主要分成三部分

1. 产生要抓取的url子集，进行相应的过滤和规格化操作
2. 读取上面产生的url子集，生成多个segment
3. 更新crawldb数据库,以保证下一次Generate不会包含相同的url

### 3.1 第一部分，产生url子集分析

这里主要是一个MP任务，用于产生相应的url抓取集合，主要代码如下：

{% highlight java %}
// map to inverted subset due for fetch, sort by score
JobConf job = new NutchJob(getConf());
job.setJobName("generate: select from " + dbDir);
// 如果用户没有设置numFetchers这个值，那就默认为Map的个数
if (numLists == -1) { // for politeness make
    numLists = job.getNumMapTasks(); // a partition per fetch task
}
// 如果MapReduce的设置为local,那就产生一个输出文件
// NOTE:这里partition也是Hadoop中的一个概念，就是在Map后，它会对每一个key进行partition操作，看这个key会映射到哪一个reduce上，
// 所以相同key的value就会聚合到这个reduce节点上
if ("local".equals(job.get("mapred.job.tracker")) && numLists != 1) {
    // override
    LOG.info("Generator: jobtracker is 'local', generating exactly one partition.");
    numLists = 1;
}
job.setLong(GENERATOR_CUR_TIME, curTime);
// record real generation time
long generateTime = System.currentTimeMillis();
job.setLong(Nutch.GENERATE_TIME_KEY, generateTime);
job.setLong(GENERATOR_TOP_N, topN);
job.setBoolean(GENERATOR_FILTER, filter);
job.setBoolean(GENERATOR_NORMALISE, norm);
job.setInt(GENERATOR_MAX_NUM_SEGMENTS, maxNumSegments);
// 配置输入路径
FileInputFormat.addInputPath(job, new Path(dbDir, CrawlDb.CURRENT_NAME));
job.setInputFormat(SequenceFileInputFormat.class);                         // 配置CrawlDb的输入格式
// 配置Mapper,Partitioner和Reducer，这里都是Selector，因为它继承了这三个抽象接口
job.setMapperClass(Selector.class);
job.setPartitionerClass(Selector.class);
job.setReducerClass(Selector.class);
FileOutputFormat.setOutputPath(job, tempDir);                               // 配置输出格式
job.setOutputFormat(SequenceFileOutputFormat.class);                        // 配置输出的key,value的类型<FloatWritable,SelectorEntry>
job.setOutputKeyClass(FloatWritable.class);                                 // 因为Map的输出会按key来排序，所以这里扩展了一个排序比较方法
job.setOutputKeyComparatorClass(DecreasingFloatComparator.class);
job.setOutputValueClass(SelectorEntry.class);                               // 设置输出格式，这个类继承自OutputFormat,如果用户要扩展自己的OutputFormat，那必须继承自这个抽象接口
job.setOutputFormat(GeneratorOutputFormat.class);
try {
    JobClient.runJob(job);                                                  // 提交任务
} catch (IOException e) {
    throw e;
}
{% endhighlight %}

下面主要分析一下Selector这个类，它使用了多重继承，同时实现了三个接口，Mapper,Partitioner,Reducer

#### 下面是Selector中Mapper的分析

这里的Map主要做了几件事：

* 如果有filter设置，先对url进行过滤
* 通过FetchSchedule查看当前url是不达到了抓取的时间，没有达到抓取时间的就过滤掉
* 计算新的排序分数，根据url的当前分数，这里调用了ScoringFilters的generatorSortValue方法
* 对上一步产生的分数进行过滤，当这个分数小于一定的阀值时，对url进行过滤
* 收集所有没有被过滤的url信息，输出为&lt;FloatWritable,SelectorEntry&gt;类型，这里的key就是第三步计算出来的分数，在Map的输出会调用DecreasingFloatComparator方法来对这个key进行排序

#### Selector中的Partition方法主要是调用了URLPartition来进行相应的分块操作

这里会首先根据url的hashCode来进行partition,如果用户设置了根据domain或者ip来进行partition，那这里会根据用户的配置来进行相应的partition操作，最后调用如下方法来得到一个映射的reduceID号

{% highlight java %}
(hashCode & Integer.MAX_VALUE) % numReduceTasks;
{% endhighlight %}

#### Selector中的Reducer操作主要是收集没有被过滤的url，每个reducer的url个数不会超过limit个数，这个limit是通过如下公式计算的

{% highlight java %}
limit = job.getLong(GENERATOR_TOP_N, Long.MAX_VALUE) / job.getNumReduceTasks();
{% endhighlight %}

GENERATOR_TOP_N是用户定义的，reducer的个数也是用户定义的。

在一个reducer任务中，如果收集的url个数超过了这个limit,那就新开一个segment,这里的segment也有一个上限，就是用户设置的maxNumSegments, 当新开的segment个数大小这个maxNumSegment时，url就会被过滤掉。

这里url在segment中的分布有两个情况，一种是当没有设置GENERATOR_MAX_COUNT这个参数时，每一个segment中所包含的url个数不超过limit上限，segmetn中对url的host个数没有限制，而segment个数的上限为maxNumSegments这个变量的值，这个变量是通过设置GENERATOR_MAX_NUM_SEGMENTS这个参数得到的，默认为1,所以说默认只产生一个segment; 而当设置了GENERATOR_MAX_COUNT的时候，每一个segment中所包含的url的host的个数的上限就是这个maxCount的值，也就是说每一个segment所包含的同一个host的url的个数不能超过maxCount这个值，当超过这个值后，就把这个url放到下一个segment中去。

举个简单的例子，如果Reducer中收到10个url，而现在maxNumSegments为2，limit为5，也就是说一个segment最多放5个url，那这时如果用第一种设置的话，那0-4个url会放在第一个segment中，5-9个url会放在第二个segment中,这样的话，两个segment都放了5个url;但如果用第二种方法，这里设置的maxCount为4，但我们这里的10个url按host分成2类，也就是说0-4个url属于同一个host1, 5-9个url属于host2，那这里会把0-4个中的前4个url放在segment1中，host1的第5个url放在segmetn2中，而host2中的5-8个url会放在segment1中，而第9个网页会放在segment2中，因为这里的maxCount设置为4，也就是说在每一个segment中，一个host所对应的url不能超过4，所以这里的segment1放了8个url，而segment2放了2个url，这里会现出不均匀的情况。

有没有注意到这里的OutputFormat使用了GenerateOutputFormat，它扩展了MultipleSequenceFileOutputFormat,重写了generateFileNameForKeyValue这个方法，就是对不同的segment生成不同的目录名，生成规则如下

{% highlight java %}
"fetchlist-" + value.segnum.toString() + "/" + name;
{% endhighlight %}

### 3.2 第二部分是读取上面产生的url子集，生成多个segment,主要代码如下：

{% highlight java %}
// read the subdirectories generated in the temp
// output and turn them into segments
List<Path> generatedSegments = new ArrayList<Path>();
FileStatus[] status = fs.listStatus(tempDir);                                              // 这里读取上面生成的多个fetchlist的segment
try {
    for (FileStatus stat : status) {
        Path subfetchlist = stat.getPath();
        if (!subfetchlist.getName().startsWith("fetchlist-")) continue;                // 过滤不是以fetchlist-开头的文件
            // start a new partition job for this segment
            Path newSeg = partitionSegment(fs, segments, subfetchlist, numLists);      // 对segment进行Partition操作，产生一个新的目录
            generatedSegments.add(newSeg);
        }
    }    
} catch (Exception e) {
    LOG.warn("Generator: exception while partitioning segments, exiting ...");
    fs.delete(tempDir, true);
    return null;
}
if (generatedSegments.size() == 0) {
    LOG.warn("Generator: 0 records selected for fetching, exiting ...");
    LockUtil.removeLockFile(fs, lock);
    fs.delete(tempDir, true);
    return null;
}
{% endhighlight %}

下面主要对这个partitionSegment函数进行分析，看看到底做了些什么

{% highlight java %}
// invert again, partition by host/domain/IP, sort by url hash
// 从代码的注释中我们可以看到，这里主要是对url按host/domain/IP进行分类
// NOTE：这里的分类就是Partition的意思，就是相同host或者是domain或者是IP的url发到同一台机器上
// 这里主要是通过URLPartitioner来做的，具体是按哪一个来分类，是通用参数来配置的，这里有PARTITION_MODE_DOMAIN，PARTITION_MODE_IP来配置，默认是按Url的hashCode来分。
   
if (LOG.isInfoEnabled()) {
    LOG.info("Generator: Partitioning selected urls for politeness.");
}
Path segment = new Path(segmentsDir, generateSegmentName());                      // 也是在segmentDir目录产生一个新的目录，以当前时间命名
Path output = new Path(segment, CrawlDatum.GENERATE_DIR_NAME);                    // 在上面的目录下再生成一个特定的crawl_generate目录
LOG.info("Generator: segment: " + segment);                                       // 下面又用一个MP任务来做
NutchJob job = new NutchJob(getConf());
job.setJobName("generate: partition " + segment);
job.setInt("partition.url.seed", new Random().nextInt());                         // 这里产生一个Partition的随机数
FileInputFormat.addInputPath(job, inputDir);                                      // 输入目录名
job.setInputFormat(SequenceFileInputFormat.class);                                // 输入文件格式
job.setMapperClass(SelectorInverseMapper.class);                                  // 输入的Mapper，主要是过滤原来的key,使用url来做为新的key值
job.setMapOutputKeyClass(Text.class);                                             // Mapper的key输出类型，这里就是url的类型
job.setMapOutputValueClass(SelectorEntry.class);                                  // Mapper的value的输出类型，这里还是原因的SelectorEntry类型
job.setPartitionerClass(URLPartitioner.class);                                    // 这里的key(url)的Partition使用这个类来做,这个类前面有说明
job.setReducerClass(PartitionReducer.class);                                      // 这里的Reducer类，
job.setNumReduceTasks(numLists);                                                  // 这里配置工作的Reducer的个数，也就是生成几个相应的输出文件
FileOutputFormat.setOutputPath(job, output);                                      // 配置输出路径
job.setOutputFormat(SequenceFileOutputFormat.class);                              // 配置输出格式
job.setOutputKeyClass(Text.class);                                                // 配置输出的key与value的类型
job.setOutputValueClass(CrawlDatum.class);                                        // 注意这里返回的类型为<Text,CrawlDatum>
job.setOutputKeyComparatorClass(HashComparator.class);                            // 这里定义控制key排序的比较方法
JobClient.runJob(job);                                                            // 提交任务
return segment;
{% endhighlight %}

### 3.3 第三部分是更新crawldb数据库，以保证下一次Generate不会包含相同的url，这个是可以配置的，主要代码如下：

{% highlight java %}
if (getConf().getBoolean(GENERATE_UPDATE_CRAWLDB, false)) {                               // 判断是否要把状态更新到原来的数据库中
   
    // update the db from tempDir
    Path tempDir2 = new Path(getConf().get("mapred.temp.dir", ".") + "/generate-temp-" + System.currentTimeMillis());
    job = new NutchJob(getConf());                                                            // 生成MP任务的配置
    job.setJobName("generate: updatedb " + dbDir);
    job.setLong(Nutch.GENERATE_TIME_KEY, generateTime);                                       // 加上面生成的所有segment的路径做为输入
    for (Path segmpaths : generatedSegments) {                                // add each segment dir to input path
        Path subGenDir = new Path(segmpaths, CrawlDatum.GENERATE_DIR_NAME);
        FileInputFormat.addInputPath(job, subGenDir);
    }
    // add current crawldb to input path                                                  // 把数据库的路径也做为输入
    FileInputFormat.addInputPath(job, new Path(dbDir, CrawlDb.CURRENT_NAME));
    job.setInputFormat(SequenceFileInputFormat.class);                                    // 定义了输入格式
    job.setMapperClass(CrawlDbUpdater.class);                                             // 定义了Mapper与Reducer方法
    job.setReducerClass(CrawlDbUpdater.class);
    job.setOutputFormat(MapFileOutputFormat.class);                                       // 定义了输出格式
    job.setOutputKeyClass(Text.class);                                                    // 定义了输出的key与value的类型
    job.setOutputValueClass(CrawlDatum.class);
    FileOutputFormat.setOutputPath(job, tempDir2);                                        // 定义了临时输出目录
    try {
        JobClient.runJob(job);
        CrawlDb.install(job, dbDir);                                                      // 删除原来的数据库，把上面的临时输出目录重命名为真正的数据目录名
    } catch (IOException e) {
        LockUtil.removeLockFile(fs, lock);
        fs.delete(tempDir, true);
        fs.delete(tempDir2, true);
        throw e;
    }
    fs.delete(tempDir2, true);
}
{% endhighlight %}

#### 下面我们来看一下CrawlDbUpdater类做了些什么，它实现了Mapper与Reducer的接口，接口说明如下

它是用来更新CrawlDb数据库，以保证下一次Generate不会包含相同的url
它的map函数很简单，只是收集相应的&lt;key,value&gt;操作，没有做其它操作，下面我们来看一下它的reduce方法做了些什么 `genTime.set(0L)`;

{% highlight java %}
while (values.hasNext()) { // 这里遍历相同url的CrawlDatum值
    CrawlDatum val = values.next();
    if (val.getMetaData().containsKey(Nutch.WRITABLE_GENERATE_TIME_KEY)) {         // 判断当前url是否已经被generate过
        LongWritable gt = (LongWritable) val.getMetaData().get(Nutch.WRITABLE_GENERATE_TIME_KEY);     // 得到Generate的时间;
        genTime.set(gt.get());
        if (genTime.get() != generateTime) { // 还没看明白这里是什么意思，一种情况会产生不相同，当这个url已经被generate一次，这里被第二次generate，所以会产生时间不同
            orig.set(val);
            genTime.set(0L);
            continue;
        }
    } else {
        orig.set(val);
    }
}
if (genTime.get() != 0L) {                    // NOTE:想想这里什么时候genTime为0,当这个url被过滤掉，或者没有符合Generate要求，或者分数小于相应的阀值时
    orig.getMetaData().put(Nutch.WRITABLE_GENERATE_TIME_KEY, genTime);          // 设置新的Generate时间
}
output.collect(key, orig);
{% endhighlight %}

## 4. 总结 {#summary}

这里大概介绍了一下Generate的流程，其中大量用到了MapReduce任务，还有大量的配置，要深入理解还需要去自己实践来加深理解。