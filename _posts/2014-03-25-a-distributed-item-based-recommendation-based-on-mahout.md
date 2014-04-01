---
layout: post
title: "A Distributed Item based Recommendation Based on Mahout"
category: Recommendation
tags: [mahout, recommendation, hadoop, map-reduce]
---
## 算法分析 {#problem-analyzing}

假设存在一个网购平台，平台会记录每一个用户对商品的访问记录，假设有以下的访问记录（1-9:商品，A-F:用户）

A 1 2 3 8 9

B 2 4 7 8

C 1 3 4 5 6

D 2 4 6 8

E 1 3 5 7 9

F 1 2 3 4 5 6 7 8 9

则可以得出一个矩阵:

<table class="table table-bordered">
	<tbody>
		<tr class="info"><td><strong>Items</strong></td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td>9</td></tr>
		<tr><td class="info">1</td><td>4</td><td>2</td><td>4</td><td>2</td><td>3</td><td>2</td><td>2</td><td>2</td><td>3</td></tr>
		<tr><td class="info">2</td><td>2</td><td>4</td><td>2</td><td>3</td><td>1</td><td>2</td><td>2</td><td>4</td><td>2</td></tr>
		<tr><td class="info">3</td><td>4</td><td>2</td><td>4</td><td>2</td><td>3</td><td>2</td><td>2</td><td>2</td><td>3</td></tr>
		<tr><td class="info">4</td><td>2</td><td>3</td><td>2</td><td>4</td><td>2</td><td>3</td><td>2</td><td>3</td><td>1</td></tr>
		<tr><td class="info">5</td><td>3</td><td>1</td><td>3</td><td>2</td><td>3</td><td>2</td><td>2</td><td>1</td><td>2</td></tr>
		<tr><td class="info">6</td><td>2</td><td>2</td><td>2</td><td>3</td><td>2</td><td>3</td><td>1</td><td>2</td><td>1</td></tr>
		<tr><td class="info">7</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>1</td><td>3</td><td>2</td><td>2</td></tr>
		<tr><td class="info">8</td><td>2</td><td>4</td><td>2</td><td>3</td><td>1</td><td>2</td><td>2</td><td>4</td><td>2</td></tr>
		<tr><td class="info">9</td><td>3</td><td>2</td><td>3</td><td>1</td><td>2</td><td>1</td><td>2</td><td>2</td><td>3</td></tr>
	</tbody>
</table>

<div class="bs-callout bs-callout-info">
以上第一行和第一列并不属于矩阵，另外，每件商品对于自身的共生值是在整个用户浏览记录存在的次数，该值是否会对推荐结果产生影响？
</div>

对于一个用户对n个商品的浏览情况（可以将其假设为对商品的关注程度，或者是购买意向）,我们将它看做是一个n维向量, 由于我们没有用户对每件商品的喜爱程度的数据，所以所有向量中的值都为0(未浏览)或1(浏览过)。比如A用户浏览记录对应的向量为[1, 1, 1, 0, 0, 0, 0, 1, 1].

针对具体的一个用户进行推荐

* 基于用户相似度：计算两个用户的相似度的问题转化为计算两个向量间的距离，距离越近，则两个用户越相似。

<img src="/assets/img/cossimilary.png" class="img-thumbnail">

*该图片摘自[余弦相似性－维基百科](http://zh.wikipedia.org/wiki/%E4%BD%99%E5%BC%A6%E7%9B%B8%E4%BC%BC%E6%80%A7)*

产生的相似度介于-1和1之间，-1代表截然相反，0代表相互独立，1代表相同

* 基于商品相似度：将商品相似度的矩阵与用户浏览记录的n维向量相乘，计算结果如下：

<img src="/assets/img/multiplication.png" class="img-thumbnail">

从中选出值最高的entity（不包含用户已经查看的）。 具体计算结果为[15,14,15,11,10,9,10,14,13],由于商品1，2，3，8，9，用户A都访问过(灰色)，其值可以忽略，则剩下的最大值为11，即商品4推介度最高。

> 为什么乘积最高的项推介度最高呢？
> > 2 * 1 + 3 * 1 + 2 * 1 + 4 * 0 + 2 * 0 + 3 * 0 + 2 * 0 + 3 * 1 + 1 * 1 = 11
> > 第4行的值代表商品4与其他商品的共生数（与其他商品同时被多少个用户浏览），这样，如果商品4与用户A浏览过的大部分商品共生的话，那么商品4可能会是用户A比较感兴趣的。上面的算式中，商品4与其他商品的共生数和用户A对这些商品的浏览记录相重叠（如上式中第一个乘积2 * 1中，2为商品4与商品1的共生数，1为用户A浏览过商品1），当和值越大，说明包含的与商品4共生的商品也就越多。这样也就证明了矩阵乘积结果中的最大项就是最好的推介。

## MapReduce算法简介 {#map-reduce}

1. 输入需要转换成许多key-value(K1,V1)的形式
2. 实现一个map方法来处理每一个(K1,V1)键值对，并输出一个不同类型的键值对(K2,V2)
3. 每一个K2下的所有V2合并（hadoop自行处理）
4. 实现一个reduce方法处理每一个K2以及和它关联的所有V2，并输出一个不同类型的键值对(K3,V3)，输出到HDFS。

针对上面假设的网购平台实现分布式算法, 假设输入文件是以每行一个用户来表示它的浏览记录，它的形式为：UserId:ItemID1 ItemID2 ItemID3 ...,该文件放置于HDFS实例中.

## 生成用户向量 {#generate-user-vector}

1. 输入数据转换成(Long, String)键值对，Long键值表示文件的行数，String值是每一行的文件数据，例如 123 / C:1 3 4 5 6
2. 实现一个map方法，将上述输入转换成针对每一个商品，生成一个(UserId,ItemId).例如 C / 1, C / 3等
3. hadoop帮助我们将每一个用户及其对应的所有商品合并起来形成C / [1,3,4,5,6]
4. 实现一个reduce方法，根据该用户下的所有商品构造一个Vector（来自于mahout），输出用户ID和用户浏览记录的Vector。例如C / {1:1, 3:1, 4:1, 5:1, 6:1}。

A mapper that parses Wikipedia link files

{% highlight java %}
public class WikipediaToItemPrefsMapper
                extends Mapper<LongWritable,Text,VarLongWritable,VarLongWritable> {
  
    private static final Pattern NUMBERS = Pattern.compile("(\\d+)");
  
    public void map(LongWritable key, Text value, Context context)
                    throws IOException, InterruptedException {
        String line = value.toString();
        Matcher m = NUMBERS.matcher(line);
        m.find();
        VarLongWritable userID = new VarLongWritable(Long.parseLong(m.group()));
        VarLongWritable itemID = new VarLongWritable();
        while (m.find()) {
            itemID.set(Long.parseLong(m.group()));
            context.write(userID, itemID);
        }
    }
}
{% endhighlight %}

Reducer which produces Vectors from a user’s item preferences

{% highlight java %}
public class WikipediaToUserVectorReducer extends
            Reducer<VarLongWritable,VarLongWritable,VarLongWritable,VectorWritable> {
  
    public void reduce(VarLongWritable userID, Iterable<VarLongWritable> itemPrefs, Context context) throws IOException, InterruptedException {
        Vector userVector = new RandomAccessSparseVector(Integer.MAX_VALUE, 100);
        for (VarLongWritable itemPref : itemPrefs) {
            userVector.set((int)itemPref.get(), 1.0f);
        }
        context.write(userID, new VectorWritable(userVector));
    }
}
{% endhighlight %}

## 计算共生 {#cal-co-occurrence}

该过程的输入直接使用上一步的数据结果。

1. 输入数据为用户ID和其对应的浏览记录向量的键值对，例如C / {1:1, 3:1, 4:1, 5:1, 6:1}。
2. 实现一个map方法，将该用户下所有商品之间的ID相互映射，如1/3,1/4,1/5,1/6,3/4,3/5,3/6等。
3. hadoop帮助我们将map方法输出的所有结果按key（第一个itemID）分类并合并，形成类似于1 / [2, 3, 8, 9, 3, 4, 5, 6, 3, 5, 7, 9, 2, 3, 4, 5, 6, 7, 8, 9]
4. 实现一个reduce方法，统计与该商品下同时出现的所有商品的次数，其输出结果为商品ID与该商品和其他商品的共生次数形成的向量的键值对，例如1 / {2:2, 3:3, 4:2, 5:3, 6:2, 7:2, 8:2, 9:3}

Mapper component of co-occurrence computation

{% highlight java %}
public class UserVectorToCooccurrenceMapper extends
        Mapper<VarLongWritable, VectorWritable, IntWritable, IntWritable> {
  
  
    public void map(VarLongWritable userID, VectorWritable userVector,
            Context context) throws IOException, InterruptedException {
        Iterator<Vector.Element> it = userVector.get().iterateNonZero();
        while (it.hasNext()) {
            int index1 = it.next().index();
            Iterator<Vector.Element> it2 = userVector.get().iterateNonZero();
            while (it2.hasNext()) {
                int index2 = it2.next().index();
                context.write(new IntWritable(index1), new IntWritable(index2));
            }
        }
    }
}
{% endhighlight %}

Reducer component of co-occurrence computation

{% highlight java %}
public class UserVectorToCooccurrenceReducer extends
        Reducer<IntWritable, IntWritable, IntWritable, VectorWritable> {
  
  
    public void reduce(IntWritable itemIndex1,
            Iterable<IntWritable> itemIndex2s, Context context)
            throws IOException, InterruptedException {
        Vector cooccurrenceRow = new RandomAccessSparseVector(
                Integer.MAX_VALUE, 100);
        for (IntWritable intWritable : itemIndex2s) {
            int itemIndex2 = intWritable.get();
            cooccurrenceRow.set(itemIndex2,
                    cooccurrenceRow.get(itemIndex2) + 1.0);
        }
        context.write(itemIndex1, new VectorWritable(cooccurrenceRow));
    }
}
{% endhighlight %}

## 向量相乘 {#vector-multiply}

在算法分析过程中，为了针对某一用户进行推荐，我们需要将[共生矩阵与用户的浏览记录向量相乘](https://mengke.atlassian.net/wiki/display/RDN/A+distributed+item-based+recommendation+based+on+Mahout#Adistributeditem-basedrecommendationbasedonMahout-matrixmultiple)，从而计算出能够表达该用户对所有商品可能感兴趣的向量，该计算过程如下：

<table class="table table-bordered">
	<tbody>
		<tr><td>
		<div>for each row i in the co-occurrence matrix</div>
		<ul>
			<li>compute dot product of row vector i with the user vector</li>
			<li>assign dot product to ith element of R</li>
		</ul></td><td>
		<div>循环遍历共生矩阵中每一行</div>
		<ul>
			<li>计算矩阵第i行与用户浏览向量的点乘积</li>
			<li>将结果赋给R的第i个元素</li>
		</ul>
		</td></tr>
	</tbody>
</table>

<div class="bs-callout bs-callout-info">
点乘积：向量{a1,a2,a3}与向量{b1,b2,b3}的点乘积为一个标量，即a1b1 + a2b2 + a3b3
</div>

上述过程需要涉及到两个向量的相乘，首先将它转换为Map-Reduce的形式比较有难度，另外就是效率问题。让我们再看一种正确的向量相乘的方式：

<table class="table table-bordered">
	<tbody>
		<tr><td>
		<div>assign R to be the zero vector</div>
		<div>for each column i in the co-occurrence matrix</div>
		<ul>
			<li>multiply column vector i by the ith element of the user vector</li>
			<li>add this vector to R</li>
		</ul></td><td>
		<div>将R设置为一个零向量</div>
		<div>循环遍历共生矩阵的每一列</div>
		<ul>
			<li>将矩阵中第i列作为向量与用户浏览向量的第i个元素相乘，形成一个新的向量</li>
			<li>将该向量与R相加</li>
		</ul>
		</td></tr>
	</tbody>
</table>

<div class="bs-callout bs-callout-info">
由于共生矩阵是一个对称矩阵，所以矩阵中的第i列与第i行形成的向量是一致的。至于此处为什么用行，请看下面分解
</div>

针对该过程，首先可以跳过向量相乘的运算，另外，当用户浏览向量的第i个元素为0时，矩阵中的第i列可忽略，这样在所有用户浏览记录较少的情况下，可以极大的提高效率。

针对第二种算法的理解，由于我们最终针对每一个用户的推荐结果是一个向量，所以我们可以将上述矩阵乘法转换成为

<img src="/assets/img/multiplication2.png" class="img-thumbnail">

虽然在实际情况下，它们相乘的结果并不相同，但由于我们只关心它们相乘后得到的数列，所以此时可以如此理解

然后第二种算法其实就是矩阵相乘中的系数-向量方法。参见[矩阵乘法](http://zh.wikipedia.org/wiki/%E7%9F%A9%E9%99%A3%E4%B9%98%E6%B3%95)

系数-向量方法可以理解为

> 循环遍历左边矩阵到第i行，
> > 将R设置为一个零向量
> > 循环遍历第i行中的第j个元素
> > > 将第j个元素与右边矩阵中第j行的向量相乘，形成一个新的向量（这也就是为什么上面用的是行）
> > > 上一步计算结果与R相加
> > 将R作为计算结果的第i行

<div class="bs-callout bs-callout-info">
第二种算法的巧妙之处在于将表示一个商品与其他商品共生值的向量乘以用户浏览向量（两个不同类型的向量）的过程转化成为针对与某个用户对所有已浏览的商品与其共生商品向量的叠加，而这个计算过程是同类向量的叠加，而这正符合Map-Reduce聚合的形式
</div>

系数-向量法计算矩阵乘积

要实现上述过程，我们需要每一件商品与其共生商品的共生值组成的向量，以及对于一件商品的浏览记录（0或者1），这需要将两种不同类型的数据合并在一个计算过程中。这样的话我们建立了一个类VectorOrPrefWritable用来同时保存这两种数据，以使得这两种数据可以被一个计算过程（reduce）使用，该类结构如下

{% highlight java %}
class VectorOrPrefWritable {
    Vector vector;   // 用来表示商品Z与其共生的商品的共生值形成的向量
    long userId;     // 用户ID
    float value;    // 用户a是否浏览过商品Z，1.0：浏览过，0.0，未浏览
}
{% endhighlight %}

该过程实际上包含两个map过程，而没有实际的reduce过程

* mapper1：对共生矩阵进行包装，直接将计算共生过程输出的结果使用VectorOrPrefWritable进行包装，同样是商品的ID以及该商品与其共生商品的共生值组成的向量的键值对
* mapper2：分割用户浏览向量，输入数据为用户ID和其对应的用户浏览向量的键值对，例如C / {1:1, 3:1, 4:1, 5:1, 6:1}

每一个非0的向量元素放入VectorOrPrefWritable的userId和value属性，输出数据为以商品ID和浏览过该商品的所有用户ID与value值，如1 / [A:1.0], 1 / [C:1.0], 1 / [E:1.0], 1 / [F:1.0]

hadoop将上述两个mapper的结果通过商品ID进行合并。

Wrapping co-occurrence columns

{% highlight java %}
public class CooccurrenceColumnWrapperMapper extends
        Mapper<IntWritable, VectorWritable, IntWritable, VectorOrPrefWritable> {
  
  
    public void map(IntWritable key, VectorWritable value, Context context)
            throws IOException, InterruptedException {
        context.write(key, new VectorOrPrefWritable(value.get()));
    }
}
{% endhighlight %}

Splitting user vectors

{% highlight java %}
public class UserVectorSplitterMapper
        extends
        Mapper<VarLongWritable, VectorWritable, IntWritable, VectorOrPrefWritable> {
  
  
    public void map(VarLongWritable key, VectorWritable value, Context context)
            throws IOException, InterruptedException {
        long userID = key.get();
        Vector userVector = value.get();
        Iterator<Vector.Element> it = userVector.iterateNonZero();
        IntWritable itemIndexWritable = new IntWritable();
        while (it.hasNext()) {
            Vector.Element e = it.next();
            int itemIndex = e.index();
            float preferenceValue = (float) e.get();
            itemIndexWritable.set(itemIndex);
            context.write(itemIndexWritable,
                    new VectorOrPrefWritable(userID, preferenceValue));
        }
    }
}
{% endhighlight %}

这两个mapper（实质上是两个独立的job）执行完之后，输出的数据作为另外一个MapReduce过程的输入，该过程map不做任何操作，reduce方法将上述的结果合并在一起，以商品ID和VectorAndPrefsWritable键值对的形式输出，这个过程mahout已经为我们实现，详见下面代码

ToVectorAndPrefReducer.java

{% highlight java %}
public final class ToVectorAndPrefReducer extends
    Reducer<VarIntWritable,VectorOrPrefWritable,VarIntWritable,VectorAndPrefsWritable> {
  @Override
  protected void reduce(VarIntWritable key,
                        Iterable<VectorOrPrefWritable> values,
                        Context context) throws IOException, InterruptedException {
    List<Long> userIDs = Lists.newArrayList();
    List<Float> prefValues = Lists.newArrayList();
    Vector similarityMatrixColumn = null;
    for (VectorOrPrefWritable value : values) {
      if (value.getVector() == null) {
        // Then this is a user-pref value
        userIDs.add(value.getUserID());
        prefValues.add(value.getValue());
      } else {
        // Then this is the column vector
        if (similarityMatrixColumn != null) {
          throw new IllegalStateException("Found two similarity-matrix columns for item index " + key.get());
        }
        similarityMatrixColumn = value.getVector();
      }
    }
    if (similarityMatrixColumn == null) {
      return;
    }
    VectorAndPrefsWritable vectorAndPrefs = new VectorAndPrefsWritable(similarityMatrixColumn, userIDs, prefValues);
    context.write(key, vectorAndPrefs);
  }
}
{% endhighlight %}

VectorAndPrefsWritable结构

{% highlight java %}
class VectorAndPrefsWritable {
    Vector vector;    // 用来表示商品Z与其共生的商品的共生值形成的向量
    List<Long> userIds; // 浏览过商品Z的所有用户ID列表
    List<float> values; // 对应与用户的value值，在该例中一般为1
}
{% endhighlight %}

现在我们已经拥有了我们需要的数据，接下来我们将计算用户对某一件商品浏览值与该商品与其共生商品的共生值形成的向量的乘积

输入数据为ToVectorAndPrefReducer产生的结果，商品ID和VectorAndPrefsWritable的键值对

实现一个map方法，计算针对商品1和其共生商品的共生值形成的向量与浏览过商品1的所有用户对商品1浏览值（一般为1）的乘积，并以用户ID与该用户浏览值乘以商品1共生向量产生的结果的键值对输出，例如A / {2:2, 3:3, 4:2, 5:3, 6:2, 7:2, 8:2, 9:3}

hadoop将map输出结果通过userId合并。

实现一个reduce方法，将该用户ID下的所有向量相加，其结果就是对该用户的推荐向量(用户ID和推荐向量的键值对)，例如A / {1:15, 2:14, 3:15, 4:11, 5:10, 6:9, 7:10, 8:14, 9:13}

Computing partial recommendation vectors

{% highlight java %}
public class PartialMultiplyMapper extends
        Mapper<IntWritable, VectorAndPrefsWritable, VarLongWritable, VectorWritable> {
    public void map(IntWritable key,
            VectorAndPrefsWritable vectorAndPrefsWritable, Context context)
            throws IOException, InterruptedException {
        Vector cooccurrenceColumn = vectorAndPrefsWritable.getVector();
        List<Long> userIDs = vectorAndPrefsWritable.getUserIDs();
        List<Float> prefValues = vectorAndPrefsWritable.getValues();
  
        for (int i = 0; i < userIDs.size(); i++) {
            long userID = userIDs.get(i);
            float prefValue = prefValues.get(i);
            Vector partialProduct = cooccurrenceColumn.times(prefValue);
            context.write(new VarLongWritable(userID),
                    new VectorWritable(partialProduct));
        }
    }
} 
{% endhighlight %}

该map方法输出了大量的数据，对于每一个user-item关联，都要输出一个user-共生向量，然后将他们按用户ID分组，聚合，并将共生向量相加，我们可以添加一个combiner来对这个过程优化，combiner更像一个缩小版的reducer，其实combiner就是继承了Reducer，combiner在map输出仍然在内存时执行，这样在reduce过程之前，先将一部分map输出聚合，帮助我们节省了一部分I/O资源，***但是，combiner并不能取代reducer，他只能将map的部分结果聚合，在reduce过程中，还需要对其结果再次进行聚合。***

Combiner for partial products

{% highlight java %}
public class AggregateCombiner extends
        Reducer<VarLongWritable, VectorWritable, VarLongWritable, VectorWritable> {
  
  
    public void reduce(VarLongWritable key, Iterable<VectorWritable> values,
            Context context) throws IOException, InterruptedException {
        Vector partial = null;
        for (VectorWritable vectorWritable : values) {
            partial = partial == null ? vectorWritable.get() : partial
                    .plus(vectorWritable.get());
        }
        context.write(key, new VectorWritable(partial));
    }
}
{% endhighlight %}

最后，对每一个用户，分别为他们计算推荐向量

Producing recommendations from vectors

{% highlight java %}
public class AggregateAndRecommendReducer
        extends
        Reducer<VarLongWritable, VectorWritable, VarLongWritable, RecommendedItemsWritable> {
  
  
    private int recommendationsPerUser = 10;
    private OpenIntLongHashMap indexItemIDMap;
    static final String ITEMID_INDEX_PATH = "itemIDIndexPath";
    static final String NUM_RECOMMENDATIONS = "numRecommendations";
    static final int DEFAULT_NUM_RECOMMENDATIONS = 10;
  
  
    protected void setup(Context context) throws IOException {
        Configuration jobConf = context.getConfiguration();
        recommendationsPerUser = jobConf.getInt(NUM_RECOMMENDATIONS,
                DEFAULT_NUM_RECOMMENDATIONS);
        indexItemIDMap = TasteHadoopUtils.readItemIDIndexMap(
                jobConf.get(ITEMID_INDEX_PATH), jobConf);
    }
  
  
    public void reduce(VarLongWritable key, Iterable<VectorWritable> values,
            Context context) throws IOException, InterruptedException {
  
  
        Vector recommendationVector = null;
        for (VectorWritable vectorWritable : values) {
            recommendationVector = recommendationVector == null ? vectorWritable
                    .get() : recommendationVector.plus(vectorWritable.get());
        }
  
  
        Queue<RecommendedItem> topItems = new PriorityQueue<RecommendedItem>(
                recommendationsPerUser + 1,
                Collections.reverseOrder(ByValueRecommendedItemComparator
                        .getInstance()));
  
  
        Iterator<Vector.Element> recommendationVectorIterator = recommendationVector
                .iterateNonZero();
        while (recommendationVectorIterator.hasNext()) {
            Vector.Element element = recommendationVectorIterator.next();
            int index = element.index();
            float value = (float) element.get();
            if (topItems.size() < recommendationsPerUser) {
                topItems.add(new GenericRecommendedItem(indexItemIDMap
                        .get(index), value));
            } else if (value > topItems.peek().getValue()) {
                topItems.add(new GenericRecommendedItem(indexItemIDMap
                        .get(index), value));
                topItems.poll();
            }
        }
  
  
        List<RecommendedItem> recommendations = new ArrayList<RecommendedItem>(
                topItems.size());
        recommendations.addAll(topItems);
        Collections.sort(recommendations,
                ByValueRecommendedItemComparator.getInstance());
        context.write(key, new RecommendedItemsWritable(recommendations));
    }
} 
{% endhighlight %}

## 推荐流程 {#process}

<img src="/assets/img/recommend.png" class="img-thumbnail">
