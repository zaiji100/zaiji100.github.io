---
layout: post
title: "Hadoop Get Started"
category: Hadoop
tags: [hadoop, InputFormat, map-reduce]
---

## Hadoop 常见问题 {#faq}

* 当你想要一次获取一行内容而输入输入有没有确定的键值时，一般使用`TextInputFormat`，`TextInputFormat`是`InputFormat`的默认实现。
* 当程序需要使用外部服务器（非集群内部服务器）时，一般使用`MapRunnable`, 一般情况下使用`Mapper`更有优势。
* 执行JOB时，需要指定`MAPRED.OUTPUT.KEY.CLASS`, `MAPRED.OUTPUT.VALUE.CLASS`, `MAPRED.MAPOUTPUT.KEY.CLASS`, `MAPRED.MAPOUTPUT.VALUE.CLASS`配置项，否则会发生Type Mismatch的Exception
* 当输入文件的大小远低于集群中块大小（CDH默认块大小为128M），并且小文件数量很多，可以使用`CombineFileInputFormat`，该类是抽象类，所以在使用时，需要自行根据需要提供一个它的实现类。使用`MAPRED.INPUT.FORMAT.CLASS`指定实现类名，并使用`MAPRED.MAX.SPLIT.SIZE`指定为map输入的最大切分大小，这样每一个mapper都能处理一个以上的块。目前项目中使用的配置为

{% highlight java %}
mapred.max.split.size＝1000000000
{% endhighlight %}

{% highlight java %}
/**
 * CombineFileInputFormat的一个实现示例
 */
public class CombinedInputFormat extends CombineFileInputFormat<LongWritable, Text> {
 
    @SuppressWarnings("unchecked")
    @Override
    public RecordReader<LongWritable, Text> getRecordReader(InputSplit split, JobConf conf, Reporter reporter) throws IOException {
        reporter.setStatus(split.toString());
        return new CombineFileRecordReader(conf, (CombineFileSplit) split, reporter, DefaultCombineFileRecordReader.class);
    }
 
    public static class DefaultCombineFileRecordReader implements RecordReader<LongWritable, Text> {
        private final LineRecordReader lineReader;
        public DefaultCombineFileRecordReader(CombineFileSplit split, Configuration conf, Reporter reporter, Integer index) throws IOException {
            FileSplit filesplit = new FileSplit(split.getPath(index), split.getOffset(index), split.getLength(index), split.getLocations());
            lineReader = new LineRecordReader(conf, filesplit);
        }
        @Override
        public void close() throws IOException {
            lineReader.close();
        }
        @Override
        public LongWritable createKey() {
            return lineReader.createKey();
        }
        @Override
        public Text createValue() {
            return lineReader.createValue();
        }
        @Override
        public long getPos() throws IOException {
            return lineReader.getPos();
        }
        @Override
        public float getProgress() throws IOException {
            return lineReader.getProgress();
        }
        @Override
        public boolean next(LongWritable key, Text value) throws IOException {
            return lineReader.next(key, value);
        }
    }
}
{% endhighlight %}

* 可以使用`MAPRED.INPUT.PATHFILTER.CLASS`过滤mapreduce处理的文件

{% highlight java %}
/**
 * 忽略掉以.tmp为后缀的文件
 */
public class TmpFileExcludePathFilter implements PathFilter {
    private final String end = ".tmp";
    @Override
    public boolean accept(Path path) {
        return !path.toString().endsWith(end);
    }
}
{% endhighlight %}

* 当使用自定义writable作为key值时，map输出正常，但reduce接收到的key不正常，需要检查该writable实现的write方法

## Secondary Sort

默认情况下，MapReduce会为我们将输入记录按照key来排序，因此，我们当需要按数据中某一个值排序时，可以使用这一特性，来提高效率。

例如，有一个网站浏览日志，记录为如下格式：

<table class="table table-bordered">
	<tr>
		<td>cookieCode(用来标示唯一一个用户)</td><td>url(被访问的URL)</td><td>visitDttm(访问时间)</td>
	</tr>
</table>

假设我们需要将每一个用户的浏览记录按照访问时间倒序排列，我们可以采用如下步骤

1. 设置一个map函数，输入为日志记录，输出以cookieCode为key，url和visitDttm组合的一个自定义`Writable`为value（`Text`＋`LongWritable`）
2. 设置一个reduce函数，该函数针对每一个用户，对其访问记录用访问时间按倒序排序，并进行输出

这样做的话，如果用户量和浏览量巨大的化，很明显上面的做法会很慢，所以我们可以利用MapReduce排序特性来完成上面的功能：

1. 设置一个map函数，输入为日志记录，输出cookieCode和visitDttm组合的一个自定义`Writable`为key，url和visitDttm组合的一个自定义`Writable`为value。（由于进入reduce函数时，keys中的visitDttm只会保留最大的值，这里需要存一份visitDttm的冗余）
2. 实现一个自定义的`Comparator`，用来将map的输出按照cookieCode升序，visitDttm降序排序
3. 实现一个自定义的`Partitioner`，由于记录中的相同用户拥有不同的key，所以这些记录不会进入同一个reduce函数，该`Partitioner`只根据cookieCode来切分
4. `Partitioner`只是确保了一个reducer能够接收到同一个cookieCode的所有记录，但并没有改变记录是按照key来分组的事实。实现一个自定义的`Comparator`，将按照cookieCode分组，这样同一个cookieCode会被分到一个reduce组，由于记录已经经过排序，每一个组的第一个元素都是该cookieCode的最新visitDttm
5. 设置一个reduce函数，输入key为每一个分组的第一个key（cookieCode-最新visitDttm），输入value为经过排序后的url和visitDttm，将它们按照需要的格式进行输出即可

代码示例如下：

{% highlight java %}
/**
 * KeyComparator.java 按照cookieCode升序，visitDttm降序排列
 */
public class KeyComparator extends WritableComparator {
 
    public KeyComparator() {
        super(TextLongPair.class, true);
    }
    @Override
    public int compare(WritableComparable a, WritableComparable b) {
        TextLongPair tlpa = (TextLongPair) a;
        TextLongPair tlpb = (TextLongPair) b;
        int cmp = tlpa.getText().compareTo(tlpb.getText());
        if (cmp != 0) {
            return cmp;
        }
        return -CompareUtil.compare(tlpa.getLongValue(), tlpb.getLongValue());  // dttm desc
    }
}
{% endhighlight %}

{% highlight java %}
/**
 * FirstPartitioner.java 按照cookieCode分区
 */
public class FirstPartitioner extends MapReduceBase implements Partitioner<TextLongPair, UrlVisitEntry> {
 
    @Override
    public int getPartition(TextLongPair key, UrlVisitEntry value, int numPartitions) {
        return Math.abs(key.getText().hashCode() * 127) % numPartitions;
    }
}
{% endhighlight %}

{% highlight java %}
/**
 * GroupComparator.java 按照cookieCode分组
 */
public class GroupComparator extends WritableComparator {
    protected GroupComparator() {
        super(TextLongPair.class, true);
    }
    @Override
    public int compare(WritableComparable a, WritableComparable b) {
        TextLongPair tlpa = (TextLongPair) a;
        TextLongPair tlpb = (TextLongPair) b;
        return tlpa.getText().compareTo(tlpb.getText());
    }
}
{% endhighlight %}

{% highlight java %}
/**
 * 将它们组合在一起
 */
public class MyJob {
    public int run(String[] args) {
        Job job = JobBuilder.parseInputAndOutput(this, getConf(), args);
        if (job == null) {
            return -1;
        }
        job.setMapperClass(XXXXMapper.class);
        job.setPartitionerClass(FirstPartitioner.class);    //
        job.setSortComparatorClass(KeyComparator.class);    //
        job.setGroupingComparatorClass(GroupComparator.class);  //
        job.setReducerClass(XXXXReducer.class);
        job.setOutputKeyClass(TextLongPair.class);
        job.setOutputValueClass(NullWritable.class);
        return job.waitForCompletion(true) ? 0 : 1;
    }
} 
{% endhighlight %}