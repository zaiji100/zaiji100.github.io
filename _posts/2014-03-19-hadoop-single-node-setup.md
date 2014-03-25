---
layout: post
title: "Hadoop Single Node Setup"
category: Hadoop
tags: [hadoop, hadoop2, setup, YARN]
---

## 环境准备 {#preparing}

### 配置无密码ssh到本机

验证是否已经可以无密码登录本机

{% highlight bash %}
$ ssh localhost
{% endhighlight %}

如果提示需要密码才能登录，则配置无密码ssh登录本机

{% highlight bash %}
$ ssh-keygen -t dsa -P '' -f ~/.ssh/id_dsa     
$ cat ~/.ssh/id_dsa.pub >> ~/.ssh/authorized_keys
{% endhighlight %}

## Hadoop 详细配置 {#configuration}

下载hadoop分发包，并解压到某个目录

{% highlight bash %}
$ tar -zxvf hadoop-2.0.1-alpha.tar.gz
{% endhighlight %}

* 配置环境变量

{% highlight bash %}
$ export HADOOP_PREFIX="/usr/local/hadoop-2.0.1-alpha"
$ export PATH=$PATH:$HADOOP_PREFIX/bin
$ export PATH=$PATH:$HADOOP_PREFIX/sbin
$ export HADOOP_MAPRED_HOME=${HADOOP_PREFIX}
$ export HADOOP_COMMON_HOME=${HADOOP_PREFIX}
$ export HADOOP_HDFS_HOME=${HADOOP_PREFIX}
$ export YARN_HOME=${HADOOP_PREFIX}
{% endhighlight %}

* 在etc/hadoop目录中编辑core-site.xml

{% highlight xml %}
<!-- core-site.xml -->
<configuration>
  <property>
    <name>fs.default.name</name>
    <value>hdfs://localhost:8020</value>
    <description>The name of the default file system.Either the literal string "local" or a host:port for NDFS.</description>
    <final>true</final>
  </property>
</configuration>
{% endhighlight %}

* 在etc/hadoop目录中编辑hdfs-site.xml

{% highlight xml %}
<!-- hdfs-site.xml -->
<configuration>
  <property>
    <name>dfs.namenode.name.dir</name>
    <value>file:/opt/hadoop/hadoop2/hadoop-2.0.1-alpha/dfs/name</value>
    <description>Determines
 where on the local filesystem the DFS name node should store the name
table.If this is a comma-delimited list of directories,then name table
is replicated in all of the directories,for redundancy.</description>
    <final>true</final>
  </property>
  <property>
    <name>dfs.datanode.data.dir</name>
    <value>file:/opt/hadoop/hadoop2/hadoop-2.0.1-alpha/dfs/data</value>
    <description>Determines
 where on the local filesystem an DFS data node should store its
blocks.If this is a comma-delimited list of directories,then data will
be stored in all named directories,typically on different
devices.Directories that do not exist are ignored.
    </description>
    <final>true</final>
  </property>
  <property>
    <name>dfs.replication</name>
    <value>1</value>
  </property>
  <property>
    <name>dfs.permission</name>
    <value>false</value>
  </property>
</configuration>
{% endhighlight %}

* 在/etc/hadoop目录下创建一个文件mapred-site.xml

{% highlight xml %}
<!-- mapred-site.xml -->
<?xml version="1.0"?>
<configuration>
  <property>
    <name>mapreduce.framework.name</name>
    <value>yarn</value>
  </property>
  <property>
    <name>mapreduce.job.tracker</name>
    <value>hdfs://localhost:10001</value>
    <final>true</final>
  </property>
  <property>
    <name>mapred.system.dir</name>
    <value>file:/opt/hadoop/hadoop2/hadoop-2.0.1-alpha/mapred/system</value>
    <final>true</final>
  </property>
  <property>
    <name>mapred.local.dir</name>
    <value>file:/opt/hadoop/hadoop2/hadoop-2.0.1-alpha/mapred/local</value>
    <final>true</final>
  </property>
  <property>
    <!-- 当nodemanager绑定8080端口时，报端口被占用的exception时，添加该配置 -->
    <name>mapreduce.shuffle.port</name>
    <value>10088</value>
    <final>true</final>
  </property>
</configuration>
{% endhighlight %}

* 在/etc/hadoop目录下编辑yarn-site.xml

{% highlight xml %}
<!-- yarn-site.xml-->
<configuration>
<!-- Site specific YARN configuration properties -->
  <property>
    <name>yarn.resourcemanager.address</name>
    <value>localhost:10080</value>
  </property>
  <property>
    <name>yarn.resourcemanager.scheduler.address</name>
    <value>localhost:10081</value>
  </property>
  <property>
    <name>yarn.resourcemanager.resource-tracker.address</name>
    <value>localhost:10082</value>
    <final>true</final>
  </property>
  <property>
    <name>yarn.nodemanager.address</name>
    <value>0.0.0.0:10084</value>
  </property>
  <!-- 添加以上属性以避免端口被占用的exception -->   
  <property>
    <name>yarn.nodemanager.aux-services</name>
    <value>mapreduce.shuffle</value>
  </property>
  <property>
    <name>yarn.nodemanager.aux-services.mapreduce.shuffle.class</name>
    <value>org.apache.hadoop.mapred.ShuffleHandler</value>
  </property>
</configuration>
{% endhighlight %}

* 在etc/hadoop目录下创建hadoop-env.sh，并添加以下内容

{% highlight bash %}
$ export JAVA_HOME=/usr/local/jdk
{% endhighlight %}

* 在etc/hadoop目录下编辑yarn-env.sh,uncomment JAVA_HOME

{% highlight bash %}
$ export JAVA_HOME=/usr/local/jdk
{% endhighlight %}

## 初始化hadoop {#initializing}

初始化namenode

{% highlight bash %}
$ hdfs namenode –format
{% endhighlight %}

## 启动hadoop {#bootstrap}

进入sbin目录

{% highlight bash %}
启动HDFS
$ ./hadoop-daemon.sh start namenode
$ ./hadoop-daemon.sh start datanode
或
$ ./start-dfs.sh
{% endhighlight %}

{% highlight bash %}
启动yarn
$ ./yarn-daemon.sh start resourcemanager
$ ./yarn-daemon.sh start nodemanager
或
$ ./start-yarn.sh
{% endhighlight %}

{% highlight bash %}
检查HDFS与YARN是否运行
$ jps
{% endhighlight %}

查看资源管理web ui   http://localhost:8088

查看HDFS web ui  http://localhost:50070
以上端口为默认端口


## 停止hadoop服务 {#stop}

{% highlight bash %}
停止服务
$ ./stop-dfs.sh
$ ./stop-yarn.sh
或
$ ./stop-all.sh(已过时)
{% endhighlight %}