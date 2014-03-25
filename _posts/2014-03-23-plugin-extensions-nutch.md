---
layout: post
title: "Plugin Extensions - Nutch"
category: Nutch
tags: [nutch, plugin]
---
## 1. 自己扩展一个简单的插件 {#a-simple-plugin}

这里扩展一个Nutch的URLFilter插件，叫`MyURLFilter`

### 1.1 生成一个Package

首先生成一个与`urlfilter-regex`类似的包结构, 如`org.apache.nutch.urlfilter.my`

### 1.2 在这个包中生成相应的扩展文件

再生成一个`MyURLFilter.java`文件，内容如下：

{% highlight java %}
package org.apache.nutch.urlfilter.my;
   
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import org.apache.hadoop.conf.Configuration;
import org.apache.nutch.net.URLFilter;
import org.apache.nutch.urlfilter.prefix.PrefixURLFilter;
   
public class MyURLFilter implements URLFilter{
    // 这里的继承自Nutch的URLFilter扩展
    private Configuration conf; 
    public MyURLFilter() {}
      
    @Override
    public String filter(String urlString) {
        // 对url字符串进行过滤
        return "My Filter:" + urlString;
    }
   
   
    @Override public Configuration getConf() {
        return this.conf;
    }
   
   
    @Override
    public void setConf(Configuration conf) {
        this.conf = conf;
    }
   
   
    public static void main(String[] args) throws IOException {
        MyURLFilter filter = new MyURLFilter();
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        String line;
        while((line=in.readLine()) !=null) {
            String out = filter.filter(line);
            if(out != null) {
                System.out.println(out);
            }
        }
    }
}
{% endhighlight %}

### 1.3 打包成jar包并生成相应的plugin.xml文件

打包可以用ivy或者是eclipse来打，每一个plugin都有一个描述文件`plugin.xml`，内容如下：

{% highlight xml %}
 <plugin
   id="urlfilter-my"
   name="My URL Filter"
   version="1.0.0"
   provider-name="nutch.org">
   
   
   <runtime>
      <library name="urlfilter-my.jar">
         <export name="*"/>
      </library>
      <!-- 如果这里你的插件有依赖第三方库的话，可以这样写
      <library name="fontbox-1.4.0.jar"/>
      <library name="geronimo-stax-api_1.0_spec-1.jar"/>
      -->
   </runtime>
   
   
   <requires>
      <import plugin="nutch-extensionpoints"/>
   </requires>
   
   
   <extension id="org.apache.nutch.net.urlfilter.my"
              name="Nutch My URL Filter"
              point="org.apache.nutch.net.URLFilter">
      <implementation id="MyURLFilter"
                      class="org.apache.nutch.urlfilter.prefix.MyURLFilter"/>
      <!-- by default, attribute "file" is undefined, to keep classic behavior.
      <implementation id="PrefixURLFilter"
                      class="org.apache.nutch.net.PrefixURLFilter">
        <parameter name="file" value="urlfilter-prefix.txt"/>
      </implementation>
      -->
   </extension>
</plugin>
{% endhighlight %}

### 1.4 把需要的包与配置文件放入plugins目录中

最后把打好的jar包与`plugin.xml`放到一个`urlfilter-my`文件夹中，再把这个文件夹到到nutch的`plugins`目录下

## 2. 使用bin/nutch plugin来进行测试 {#test-plugin}

在运行`bin/nutch plugin`命令之前你要修改一下`nutch-site.xml`这个配置文件，在下面加入我们写的插件，如下

{% highlight xml %}
<property>
    <name>plugin.includes</name>
    <value>protocol-http|urlfilter-(regex|prefix|my)|parse-(html|tika)|index-(basic|anchor)|scoring-opic|urlnormalizer-(pass|regex|basic)</value>
    <description>Regular expression naming plugin directory names to
                include. &nbsp;Any plugin not matching this expression is excluded.
                In any case you need at least include the nutch-extensionpoints plugin. By
                default Nutch includes crawling just HTML and plain text via HTTP,
                and basic indexing and search plugins. In order to use HTTPS please enable&nbsp;
                protocol-httpclient, but be aware of possible intermittent problems with the&nbsp;
                underlying commons-httpclient library.
    </description>
</property>
{% endhighlight %}

在本机测试结果如下：

{% highlight bash %}
$ bin/nutch plugin urlfilter-my org.apache.nutch.urlfilter.my.MyURLFilter
   
                urlString1
                My Filter:urlString1
                urlString2
                My Filter:urlString2
{% endhighlight %}

## 3. 扩展Nutch插件实现自定义索引字段 {#custom-index}

### 3.1.Nutch与Solr的使用介绍

#### 3.1.1 一些基本的配置

* 在`conf/nutch-site.xml`加入`http.agent.name`的属性
* 生成一个种子文件夹，`mkdir -p urls`，在其中生成一个种子文件，在这个文件中写入一个url，如http://nutch.apache.org/
* 编辑`conf/regex-urlfilter.txt`文件，配置url过滤器，一般用默认的好了,也可以加入如下配置，只抓取nutch.apache.org这个网址 `+^http://(\[a-z0-9\]*\.)*nutch.apache.org/`

使用如下命令来抓取网页

{% highlight bash %}
$ bin/nutch crawl urls -dir crawl -depth 3 -topN 5
说明： -dir 抓取结果目录名 -depth 抓取的深度 -topN 最一层的最大抓取个数 一般抓取完成后会看到如下的目录 crawl/crawldb crawl/linkdb crawl/segments
{% endhighlight %}

使用如下来建立索引 

{% highlight bash %}
$ bin/nutch solrindex http://127.0.0.1:8983/solr/ crawldb -linkdb crawldb/linkdb crawldb/segments/
{% endhighlight %}

使用这个命令的前提是你已经开启了默认的solr服务 开启默认solr服务的命令如下

{% highlight bash %}
$ cd ${APACHE_SOLR_HOME}/example java -jar start.jar
{% endhighlight %}

这个时候服务就开启了 你可以在浏览器中输入如下地址进行测试 `http://localhost:8983/solr/admin/` `http://localhost:8983/solr/admin/stats.jsp` 

但是要结合Nutch来使用solr，还要在solr中加一个相应的策略配置，在nutch的conf目录中有一个默认的配置，把它复制到solr的相应目录中就可以使用了

{% highlight bash %}
$ cp ${NUTCH_RUNTIME_HOME}/conf/schema.xml ${APACHE_SOLR_HOME}/example/solr/conf/
{% endhighlight %}

这个时候要重新启动一下solr, 索引建立完成以后就你就可以用关键词进行查询，solr默认返回的是一个xml文件

### 3.2. Nutch的索引过滤插件介绍

除了一些元数据，如segment,boost,digest，nutch的其它索引字段都是通过一个叫做索引过滤的插件来完成的，如index-basic,index-more,index-anchor,这些都是通过nutch的插件机制来完成索引文件的字段生成，如果你要自定义相应的索引字段，你就要实现IndexingFilter这个接口，其定义如下：

## 4. 总结 {#summary}

这里只是写了一个简单的插件，当然你可以根据你的需求写出更加复杂的插件.

## 5. 参考 {#reference}

<http://wiki.apache.org/nutch/WritingPluginExample#The_Example>