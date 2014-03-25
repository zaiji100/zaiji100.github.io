---
layout: post
title: "Cloudera Manager Setup"
category: Hadoop
tags: [hadoop, cloudera, setup]
---

## 安装准备 {#preparing}

安装前请确认linux版本为64，因为cloudera-manager只能安装在64位版本上的linux

根据Linux版本下载相应的cloudera-manager安装包

如<http://archive.cloudera.com/cm4/redhat/5/x86_64/cm/4.5.2/>

查看linux位数

{% highlight bash %}
$ file /bin/ls
{% endhighlight %}

<img src="/assets/img/cminstaller.png" alt="Cloudera Manager RPMs" class="img-thumbnail">

## 安装过程 {#setup}

待全部下载完成后，在安装包所处目录执行以下命令

{% highlight bash %}
$ yum localinstall --nogpgcheck *.rpm
{% endhighlight %}

安装完成后，通过以下命令查看7182和7180端口是否被占用

{% highlight bash %}
$ netstat -tnlp
{% endhighlight %}

安装完毕后，访问｀http://&lt;yourip&gt;:7180｀，转向到cm的登录页面，用户名密码默认都为admin，登录后会提示向集群添加新机器

## 部分错误的解决办法 {#troubleshooting}

* percels获取超时，可以将所需的percel手动下载下来，然后放到apache中，并在cm的settings中设置cdh的存储url
* 向集群中添加主机时，如果遇到无法联系scm-server，并出现将本机hostname解析成bogon的提示信息时，说明是该服务器使用的dns服务器设置有问题，目前我的解决方法是换一个官方的dns
* 在添加主机时，如果出现无法接收到来自agent的信号的错误，检查agent机器的日志，它位于`/var/log/cloudera-scm-agent/`文件夹下，如果错误日志中提示9000和9001端口被占用，查询agent机器哪些进程使用了这两个端口`netstat -tnlp`
* 添加主机时，出现Setting default socket timeout to 30!的warning，检查dns配置和`/etc/hosts`，原`/etc/hosts`中配置为172.16.15.202 BJtestsys202 localhost.localdomain localhost