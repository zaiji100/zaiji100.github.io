---
layout: post
title: "How to change score in Lucene"
category: Lucene
tags: [lucene, score]
---
The objects we are scoring are documents. In further, Lucene scoring works on fields in the Documents and combines results to return documents. So if two documents with the exact same content, but one having the content in two Fields and the other in one Field will return different scores for the same query.

## Score boosting

* Document level boosting: while indexing, by calling document.setBoost() before a document is added to the index.
* Document's field level boosting: while indexing, by calling field.setBoost() before adding a field to the document(also before adding the document to the index).
* Query level boosting: during search, by calling query.setBoost() - setting a boost on a query clause.

## Changing Similarity

Chances are DefaultSimilarity is sufficient for all your searching needs. However, in some applications it may be necessary to customize your Similarity implementation. For instance, some applications do not need to distinguish between shorter and longer documents (see a "fair" similarity).

To change Similarity, one must do so for both indexing and searching, and the changes must happen before either of these actions take place. Although in theory there is nothing stopping you from changing mid-stream, it just isn't well-defined what is going to happen.

To make this change, implement your own Similarity (likely you'll want to simply subclass DefaultSimilarity) and then use the new class by calling IndexWriter.setSimilarity before indexing andSearcher.setSimilarity before searching.

If you are interested in use cases for changing your similarity, see the Lucene users's mailing list at Overriding Similarity. In summary, here are a few use cases:

* `SweetSpotSimilarity` --- SweetSpotSimilarity gives small increases as the frequency increases a small amount and then greater increases when you hit the "sweet spot", i.e. where you think the frequency of terms is more significant. 
* Overriding tf — In some applications, it doesn't matter what the score of a document is as long as a matching term occurs. In these cases people have overridden Similarity to return 1 from the tf() method. 
* Changing Length Normalization — By overriding lengthNorm, it is possible to discount how the length of a field contributes to a score. In DefaultSimilarity, lengthNorm = 1 / (numTerms in field)^0.5, but if one changes this to be 1 / (numTerms in field), all fields will be treated "fairly". 

In general, Chris Hostetter sums it up best in saying (from the Lucene users's mailing list):

[One would override the Similarity in] ... any situation where you know more about your data then just that it's "text" is a situation where it *might* make sense to to override your Similarity method. 

Changing Scoring — Expert Level

Changing scoring is an expert level task, so tread carefully and be prepared to share your code if you want help.

With the warning out of the way, it is possible to change a lot more than just the Similarity when it comes to scoring in Lucene. Lucene's scoring is a complex mechanism that is grounded bythree main classes:

* `Query` --- The abstract object representation of the user's information need.
* `Weight` --- The internal interface representation of the user's Query, so that Query objects may be reused.
* `Scorer` --- An abstract class containing common functionality for scoring. Provides both scoring and explanation capabilities.

Details on each of these classes, and their children, can be found in the subsections below.

## The Query Class

In some sense, the Query class is where it all begins. Without a Query, there would be nothing to score. Furthermore, the Query class is the catalyst for the other scoring classes as it is often responsible for creating them or coordinating the functionality between them. The Query class has several methods that are important for derived classes:

* createWeight(Searcher searcher) — A Weight is the internal representation of the Query, so each Query implementation must provide an implementation of Weight. See the subsection on The Weight Interface below for details on implementing the Weight interface.
* rewrite(IndexReader reader) — Rewrites queries into primitive queries. Primitive queries are: TermQuery, BooleanQuery, and other queries that implement Query.html#createWeight(Searcher searcher)

－－Query is used to create Weight instances or coordinate scoring instances.

## The Weight Interface

The Weight interface provides an internal representation of the Query so that it can be reused. Any Searcher dependent state should be stored in the Weight implementation, not in the Query class. The interface defines six methods that must be implemented:

* eight#getQuery() --- Pointer to the Query that this Weight represents.
* Weight#getValue() --- The weight for this Query. For example, the TermQuery.TermWeight value is equal to the idf^2 * boost * queryNorm
* Weight#sumOfSquaredWeights() --- The sum of squared weights. For TermQuery, this is (idf * boost)^2
* Weight#normalize(float) --- Determine the query normalization factor. The query normalization may allow for comparing scores between queries.
* Weight#scorer(IndexReader, boolean, boolean) --- Construct a new Scorer for this Weight. See The Scorer Class below for help defining a Scorer. As the name implies, the Scorer is responsible for doing the actual scoring of documents given the Query.
* Weight#explain(Searcher, IndexReader, int) --- Provide a means for explaining why a given document was scored the way it was.

## The Scorer Class

The Scorer abstract class provides common scoring functionality for all Scorer implementations and is the heart of the Lucene scoring process. The Scorer defines the following abstract (some of them are not yet abstract, but will be in future versions and should be considered as such now) methods which must be implemented (some of them inherited fromDocIdSetIterator ):

* DocIdSetIterator#nextDoc() --- Advances to the next document that matches this Query, returning true if and only if there is another document that matches.
* DocIdSetIterator#docID() --- Returns the id of the Document that contains the match. It is not valid until next() has been called at least once.
* Scorer#score(Collector) --- Scores and collects all matching documents using the given Collector.
* Scorer#score() --- Return the score of the current document. This value can be determined in any appropriate way for an application. For instance, the TermScorer returns the tf * Weight.getValue() * fieldNorm.
* DocIdSetIterator#advance(int) --- Skip ahead in the document matches to the document whose id is greater than or equal to the passed in value. In many instances, advance can be implemented more efficiently than simply looping through all the matching documents until the target document is identified.

## Why would I want to add my own Query?

In a nutshell, you want to add your own custom Query implementation when you think that Lucene's aren't appropriate for the task that you want to do. You might be doing some cutting edge research or you need more information back out of Lucene (similar to Doug adding SpanQuery functionality).

* 通过使用setBoost方法来影响document的score。
* 由于有多种Query，所以不确定Solr在实际搜索中使用哪个Query实例。最可行的方法是使用代理模式，在Scorer.score方法调用时，在外面包一层代理，并要保证不在非叶子结点实例中执行该代理方法（＊）。需弄清Solr执行score的时机。
* 通过已有的Document的score，动态计算自定义的score，并根据自定义的score来排序。

## 自定义排序的实现 {#custom-ordering}

使用Lucene来搜索内容,搜索结果的显示顺序当然是比较重要的.Lucene中Build-in的几个排序定义在大多数情况下是不适合我们使用的.要适合自己的应用程序的场景,就只能自定义排序功能,本节我们就来看看在Lucene中如何实现自定义排序功能.

Lucene中的自定义排序功能和Java集合中的自定义排序的实现方法差不多,都要实现一下比较接口. 在Java中只要实现`Comparable`接口就可以了.但是在Lucene中要实现`SortComparatorSource`接口和`ScoreDocComparator`接口.在了解具体实现方法之前先来看看这两个接口的定义吧.

`SortComparatorSource`接口的功能是返回一个用来排序`ScoreDocs的comparator`(Expert: returns a comparator for sorting ScoreDocs).该接口只定义了一个方法.如下:

{% highlight java %}
/** 
  * Creates a comparator for the field in the given index.  
  * @param reader - Index to create comparator for. 
  * @param fieldname - Field to create comparator for. 
  * @return Comparator of ScoreDoc objects.  
  * @throws IOException - If an error occurs reading the index.  
  */
public ScoreDocComparator newComparator(IndexReader reader,String fieldname) throws IOException;
{% endhighlight %}

该方法只是创造一个`ScoreDocComparator` 实例用来实现排序.所以我们还要实现`ScoreDocComparator` 接口.来看看`ScoreDocComparator` 接口.功能是比较来两个`ScoreDoc` 对象来排序(Compares two ScoreDoc objects for sorting) 里面定义了两个Lucene实现的静态实例.如下:

{% highlight java %}
//Special comparator for sorting hits according to computed relevance (document score).  
 public static final ScoreDocComparator RELEVANCE;  
          
 //Special comparator for sorting hits according to index order (document number).   
 public static final ScoreDocComparator INDEXORDER;
{% endhighlight %}

有3个方法与排序相关,需要我们实现 分别如下:

{% highlight java %}
/** 
 * Compares two ScoreDoc objects and returns a result indicating their sort order.  
 * @param i First ScoreDoc  
 * @param j Second ScoreDoc 
 * @return -1 if i should come before j;  
 *         1 if i should come after j; 
 *         0 if they are equal 
 */
public int compare(ScoreDoc i,ScoreDoc j);  
     
/** 
 * Returns the value used to sort the given document. The object returned must implement the java.io.Serializable interface. This is used by multisearchers to determine how
 * to collate results from their searchers. 
 * @param i Document 
 * @return Serializable object 
 */
public Comparable sortValue(ScoreDoc i);  
     
/** 
 * Returns the type of sort. Should return SortField.SCORE, SortField.DOC, SortField.STRING, SortField.INTEGER, SortField.FLOAT or SortField.CUSTOM. It is not valid to       
 * return SortField.AUTO. This is used by multisearchers to determine how to collate results from their searchers. 
 * @return One of the constants in SortField.  
 */
public int sortType();
{% endhighlight %}

看个例子吧!
    该例子为Lucene in Action中的一个实现,用来搜索距你最近的餐馆的名字. 餐馆坐标用字符串"x,y"来存储.

{% highlight java %}
package com.nikee.lucene;  
     
 import java.io.IOException;  
     
 import org.apache.lucene.index.IndexReader;  
 import org.apache.lucene.index.Term;  
 import org.apache.lucene.index.TermDocs;  
 import org.apache.lucene.index.TermEnum;  
 import org.apache.lucene.search.ScoreDoc;  
 import org.apache.lucene.search.ScoreDocComparator;  
 import org.apache.lucene.search.SortComparatorSource;  
 import org.apache.lucene.search.SortField;  
     
 //实现了搜索距你最近的餐馆的名字. 餐馆坐标用字符串"x,y"来存储  
 //DistanceComparatorSource 实现了SortComparatorSource接口  
 public class DistanceComparatorSource implements SortComparatorSource {  
    private static final long serialVersionUID = 1L;  
          
    // x y 用来保存 坐标位置  
    private int x;  
    private int y;  
          
    public DistanceComparatorSource(int x, int y) {  
        this.x = x;  
        this.y = y;  
    }  
          
    // 返回ScoreDocComparator 用来实现排序功能  
    public ScoreDocComparator newComparator(IndexReader reader, String fieldname) throws IOException {  
        return new DistanceScoreDocLookupComparator(reader, fieldname, x, y);  
    }  
          
    //DistanceScoreDocLookupComparator 实现了ScoreDocComparator 用来排序  
    private static class DistanceScoreDocLookupComparator implements ScoreDocComparator {  
        private float[] distances;  // 保存每个餐馆到指定点的距离  
              
        // 构造函数 , 构造函数在这里几乎完成所有的准备工作.  
        public DistanceScoreDocLookupComparator(IndexReader reader, String fieldname, int x, int y) throws IOException {  
            System.out.println("fieldName2="+fieldname);  
            final TermEnum enumerator = reader.terms(new Term(fieldname, ""));  
                  
            System.out.println("maxDoc="+reader.maxDoc());  
            distances = new float[reader.maxDoc()];  // 初始化distances  
            if (distances.length > 0) {  
                TermDocs termDocs = reader.termDocs();  
                try {  
                    if (enumerator.term() == null) {  
                        throw new RuntimeException("no terms in field " + fieldname);  
                    }  
                    int i = 0,j = 0;  
                    do {  
                        System.out.println("in do-while :" + i ++);  
                        Term term = enumerator.term();  // 取出每一个Term   
                        if (term.field() != fieldname)  // 与给定的域不符合则比较下一个  
                            break;  
                              
                        //Sets this to the data for the current term in a TermEnum.   
                        //This may be optimized in some implementations.  
                        termDocs.seek(enumerator); //参考TermDocs Doc  
                        while (termDocs.next()) {  
                            System.out.println("    in while :" + j ++);  
                            System.out.println("    in while ,Term :" + term.toString());  
                                  
                            String[] xy = term.text().split(","); // 去处x y  
                            int deltax = Integer.parseInt(xy[0]) - x;  
                            int deltay = Integer.parseInt(xy[1]) - y;  
                            // 计算距离  
                            distances[termDocs.doc()] = (float) Math.sqrt(deltax * deltax + deltay * deltay);  
                        }  
                    }   
                    while (enumerator.next());  
                } finally {  
                    termDocs.close();  
                }  
            }  
        }  
     
        //有上面的构造函数的准备 这里就比较简单了  
        public int compare(ScoreDoc i, ScoreDoc j) {  
            if (distances[i.doc] < distances[j.doc])  
                return -1;  
            if (distances[i.doc] > distances[j.doc])  
                return 1;  
            return 0;  
        }  
              
        // 返回距离  
        public Comparable sortValue(ScoreDoc i) {  
            return new Float(distances[i.doc]);  
        }  
              
        //指定SortType  
        public int sortType() {  
            return SortField.FLOAT;  
        }  
    }  
              
    public String toString() {  
        return "Distance from (" + x + "," + y + ")";  
    }  
}
{% endhighlight %}

这是一个实现了上面两个接口的两个类, 里面带有详细注释, 可以看出 自定义排序并不是很难的. 该实现能否正确实现,我们来看看测试代码能否通过吧.

{% highlight java %}
package com.nikee.lucene.test;  
     
 import java.io.IOException;  
     
 import junit.framework.TestCase;  
     
 import org.apache.lucene.analysis.WhitespaceAnalyzer;  
 import org.apache.lucene.document.Document;  
 import org.apache.lucene.document.Field;  
 import org.apache.lucene.index.IndexWriter;  
 import org.apache.lucene.index.Term;  
 import org.apache.lucene.search.FieldDoc;  
 import org.apache.lucene.search.Hits;  
 import org.apache.lucene.search.IndexSearcher;  
 import org.apache.lucene.search.Query;  
 import org.apache.lucene.search.ScoreDoc;  
 import org.apache.lucene.search.Sort;  
 import org.apache.lucene.search.SortField;  
 import org.apache.lucene.search.TermQuery;  
 import org.apache.lucene.search.TopFieldDocs;  
 import org.apache.lucene.store.RAMDirectory;  
     
 import com.nikee.lucene.DistanceComparatorSource;  
     
 public class DistanceComparatorSourceTest extends TestCase {  
    private RAMDirectory directory;  
          
    private IndexSearcher searcher;  
    private Query query;  
          
    //建立测试环境  
    protected void setUp() throws Exception {  
        directory = new RAMDirectory();  
        IndexWriter writer = new IndexWriter(directory, new WhitespaceAnalyzer(), true);  
              
        addPoint(writer, "El Charro", "restaurant", 1, 2);  
        addPoint(writer, "Cafe Poca Cosa", "restaurant", 5, 9);  
        addPoint(writer, "Los Betos", "restaurant", 9, 6);  
        addPoint(writer, "Nico's Taco Shop", "restaurant", 3, 8);  
     
        writer.close();  
        searcher = new IndexSearcher(directory);  
        query = new TermQuery(new Term("type", "restaurant"));  
    }  
          
    private void addPoint(IndexWriter writer, String name, String type, int x, int y) throws IOException {  
        Document doc = new Document();  
        doc.add(new Field("name", name, Field.Store.YES, Field.Index.TOKENIZED));  
        doc.add(new Field("type", type, Field.Store.YES, Field.Index.TOKENIZED));  
        doc.add(new Field("location", x + "," + y, Field.Store.YES, Field.Index.UN_TOKENIZED));  
        writer.addDocument(doc);  
    }  
          
    public void testNearestRestaurantToHome() throws Exception {  
        //使用DistanceComparatorSource来构造一个SortField  
        Sort sort = new Sort(new SortField("location", new DistanceComparatorSource(0, 0)));  
        Hits hits = searcher.search(query, sort);  // 搜索  
              
        //测试  
        assertEquals("closest", "El Charro", hits.doc(0).get("name"));  
        assertEquals("furthest", "Los Betos", hits.doc(3).get("name"));  
    }  
          
    public void testNeareastRestaurantToWork() throws Exception {  
        Sort sort = new Sort(new SortField("location", new DistanceComparatorSource(10, 10)));  // 工作的坐标 10,10  
        //上面的测试实现了自定义排序,但是并不能访问自定义排序的更详细信息,利用  
        //TopFieldDocs 可以进一步访问相关信息  
        TopFieldDocs docs = searcher.search(query, null, 3, sort);  
              
        assertEquals(4, docs.totalHits);  
        assertEquals(3, docs.scoreDocs.length);  
              
        //取得FieldDoc 利用FieldDoc可以取得关于排序的更详细信息 请查看FieldDoc Doc  
        FieldDoc fieldDoc = (FieldDoc) docs.scoreDocs[0];  
     
        assertEquals("(10,10) -> (9,6) = sqrt(17)", new Float(Math.sqrt(17)), fieldDoc.fields[0]);  
        Document document = searcher.doc(fieldDoc.doc);  
        assertEquals("Los Betos", document.get("name"));  
        dumpDocs(sort, docs);  // 显示相关信息  
    }  
          
    // 显示有关排序的信息  
    private void dumpDocs(Sort sort, TopFieldDocs docs) throws IOException {  
        System.out.println("Sorted by: " + sort);  
        ScoreDoc[] scoreDocs = docs.scoreDocs;  
        for (int i = 0; i < scoreDocs.length; i++) {  
            FieldDoc fieldDoc = (FieldDoc) scoreDocs[i];  
            Float distance = (Float) fieldDoc.fields[0];  
            Document doc = searcher.doc(fieldDoc.doc);  
            System.out.println("   " + doc.get("name") + " @ (" + doc.get("location") + ") -> " + distance);  
        }  
    }  
}
{% endhighlight %}