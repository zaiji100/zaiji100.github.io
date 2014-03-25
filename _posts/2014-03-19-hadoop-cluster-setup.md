---
layout: post
title: "Hadoop Cluster Setup"
category: Hadoop
tags: [hadoop, setup]
---

## 安装准备 {#preparing}

### 确保JDK1.6安装在clusters中，并保证ssh和sshd均以安装

如果ssh和sshd没有安装，可以通过以下方式来安装：

{% highlight bash %}
$ sudo apt-get install ssh
$ sudo apt-get install rsync
{% endhighlight %}

### 下载hadoop分发包，并将其解压到clusters中，最好放在同一个目录。

一般情况下，一台机器作为NameNode，另一台机器作为JobTracker，它们是masters，其他机器作为DataNode和TaskTracker，也就是slaves。各个cluster需要设置`HADOOP_INSTALL`。

{% highlight bash %}
$ export HADOOP_INSTALL=/opt/hadoop102
$ export PATH=$HADOOP_INSTALL/bin:$PATH
{% endhighlight %}

注：`HADOOP_HOME`已废弃

### Check是否能够无密码登陆本机

{% highlight bash %}
$ ssh localhost
{% endhighlight %}

如果提示需要输入密码，则需要使用如下命令来生成密钥：

{% highlight bash %}
$ ssh-keygen -t dsa -P '' -f ~/.ssh/id_dsa
$ cat ~/.ssh/id_dsa.pub >> ~/.ssh/authorized_keys
{% endhighlight %}

第一条命令会生成`id_dsa`和`id_dsa.pub`两个文件，这两个文件成对出现。

如果修改后无效，确认`.ssh`和`authorized_keys`只有用户本身有读写权限，如果仍然无效，需确认root目录不是777权限，如果是，请将其改为默认650.

接下来要确保NameNode可以无密码登陆DataNodes把NameNode中的｀id_dsa.pub｀追加到其他DataNodes的｀authorized_keys｀文件中

例如：

{% highlight bash %}
$ scp id_dsa.pub root@123.125.208.231:/root/mengke/id_dsa.pub
$ cat /root/mengke/id_dsa.pub >> ~/.ssh/authorized_keys
{% endhighlight %}

使用ssh root@123.125.208.231验证

另外如果需要使用rsync来同步各个集群的配置的话，还需要将DataNodes的公钥添加到NameNode的验证文件中

确保DataNodes可以无密码访问NameNode

### 关闭Linux防火墙

{% highlight bash %}
$ chkconfig iptables off
{% endhighlight %}

如果不关闭防火墙，会出现找不到DataNodes的问题

## 配置Hadoop {#configuration}

配置`conf/hadoop-env.sh`(须在多台机器上配置，如果是大型集群可以采用自动安装脚本来分发这些配置)

自定义`JAVA_HOME`(必配，即使在系统环境变量中配置了`JAVA_HOME`, 还是需要在文件中配置该项)

{% highlight bash %}
$ export JAVA_HOME=/usr/lib/j2sdk1.5-sun
{% endhighlight %}

设置`HADOOP_MASTER`项，该项会使用rsync把以`HADOOP_MASTER`为根目录树与本地的`HADOOP_INSTALL`目录进行同步

`HADOOP_MASTER`=123.125.208.230:/opt/hadoop102

其他有用的参数：

`HADOOP_LOG_DIR` 指定LOG输出地址

`HADOOP_HEAPSIZE` 指定使用内存大小

配置`conf/core-site.xml`

添加如下参数：

{% highlight xml %}
<!-- 指定NameNode -->
<property>
   <name>hadoop.tmp.dir</name>
   <value>/opt/hadoop_data/tmp</value>
   <description>a base directory for some temporary directories</description>
</property>
<!-- 指定NameNode -->
<property>
   <name>fs.default.name</name>
   <value>hdfs://123.125.208.230:8020</value>
</property>
<!-- 如不指定端口，默认为8020 -->
{% endhighlight %}

配置conf/hdfs-site.xml

添加如下参数：

{% highlight xml %}
<!-- dfs.replication默认为3, 如果不配置，datanode小于3台会报错 -->
<property>
  <name>dfs.replication</name>
  <value>1</value>
</property>
另外可以指定
<!-- namenode的元数据存储目录 -->
<property>
  <name>dfs.name.dir</name>
  <value>/disk1/hdfs/name,/remote/hdfs/name</value>
  <!-- <final>true</final> -->
</property>
<!-- datanode的数据存储目录 -->
<property>
  <name>dfs.data.dir</name>
  <value>/disk1/hdfs/data,/disk2/hdfs/data</value>
  <!-- <final>true</final> -->
</property>
<!-- 辅助namenode的存储文件系统的检查点目录 -->
<property>
  <name>fs.checkpoint.dir</name>
  <value>/disk1/hdfs/namesecondary,/disk2/hdfs/namesecondary</value>
  <!-- <final>true</final> -->
</property>
{% endhighlight %}

配置conf/mapred-site.xml

{% highlight xml %}
<!-- 指定JobTracker的主机名和端口 -->
<property>
  <name>mapred.job.tracker</name>
  <value>123.125.208.230:8021</value>
  <!-- <final>true</final> -->
</property>
<!-- 如不指定端口，默认为8021 -->
 
<!-- 另外可以指定 存储作业中间数据的目录列表（逗号分割目录列表） -->
<property>
  <name>mapred.local.dir</name>
  <value>/disk1/mapred/local,/disk2/mapred/local</value>
  <!-- <final>true</final> -->
</property>
<!-- 存储作业运行期间共享文件的目录（URI） -->
<property>
  <name>mapred.system.dir</name>
  <value>/tmp/hadoop/mapred/system</value>
  <!-- <final>true</final> -->
</property>
<!-- 运行在tasktracker上的map任务的最大数 -->
<property>
  <name>mapred.tasktracker.map.tasks.maximum</name>
  <value>7</value>
  <!-- <final>true</final> -->
</property>
<!-- 运行在tasktracker上的reduce任务的最大数 -->
<property>
  <name>mapred.tasktracker.reduce.tasks.maximum</name>
  <value>7</value>
  <!-- <final>true</final> -->
</property>
<!-- JVM选项，用于启动运行map和reduce任务的tasktracker子进程 -->
<property>
  <name>mapred.child.java.opts</name>
  <value>-Xmx400m</value>
  <!-- 不要标记为final，这样Jobs可以包含JVM的调试配置 -->
</property>
{% endhighlight %}

配置conf下的masters和slaves（只需在name node上设置）

masters是辅助namenode的机器列表，每行一个，如果namenode只有一个，该文件不需配置；

slaves是存放tasktracker和datanode的机器列表，每行一个

例如：

{% highlight xml %}
123.125.208.231
123.125.208.232
{% endhighlight %}

## 运行hadoop {#bootstrap}

初始化namenode

{% highlight bash %}
$ hdfs namenode –format
{% endhighlight %}

启动Hadoop

{% highlight bash %}
$ start-all.sh
{% endhighlight %}

在masters和slaves中的使用jps命令查看processes的状态

{% highlight bash %}
$ jps
{% endhighlight %}

查看集群状态

{% highlight bash %}
$ hadoop dfsadmin -report
{% endhighlight %}

通过浏览器查看namenode和jobtracker的状态

NameNode - http://123.125.208.230:50070/

JobTracker - http://123.125.208.230:50030/

如果在NameNode状态中显示没有LiveNode，请确认已经关闭防火墙，并确定DataNodes的配置与NameNode的配置相同, 可以查看有关NameNode和DataNodes的启动日志。

## 运行示例程序 {#run-samples}

Copy the input files into the distributed filesystem

{% highlight bash %}
$ bin/hadoop fs -put conf input
{% endhighlight %}

Run some of the examples provided

{% highlight bash %}
$ bin/hadoop jar hadoop-examples-*.jar grep input output 'dfs[a-z.]+'
{% endhighlight %}

Copy the output files from the distributed filesystem to the local filesytem and examine them

{% highlight bash %}
$ bin/hadoop fs -get output output
$ cat output/*
{% endhighlight %}

or

View the output files on the distributed filesystem

{% highlight bash %}
$ bin/hadoop fs -cat output/*
{% endhighlight %}
