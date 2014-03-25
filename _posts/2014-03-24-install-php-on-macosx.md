---
layout: post
title: "Install PHP on MacOSX"
category: PHP
tags: [php, install]
---

## 启动Apache服务器 {#lautch-apache}

启动apache服务器

{% highlight bash %}
$ sudo apachectl start
{% endhighlight %}

查看apache服务器版本信息

{% highlight bash %}
$ sudo apachectl －v
{% endhighlight %}

如果需要阻止其他机器访问本地服务器，可以通过编辑`/etc/apache2/httpd.conf`文件来实现，如下

阻止其他机器访问本地服务器

{% highlight xml %}
<Directory "/Library/WebServer/Documents">
    ......
    #
    # Controls who can get stuff from this server.
    #
    Order allow,deny
    #Allow from all
    Allow from 127.0.0.1
    Allow from localhost
 
</Directory>
{% endhighlight %}

## 运行PHP {#run-php}

mac下终端运行：

编辑apache配置文件

{% highlight bash %}
$ sudo vi /etc/apache2/httpd.conf
{% endhighlight %}

找到

<div class="bs-callout bs-callout-info">
	#LoadModule php5_module libexec/apache2/libphp5.so
</div>

这一行，并去掉前面的“＃”，来启用PHP模块

PHP配置

{% highlight bash %}
$ sudo cp /etc/php.ini.default /etc/php.ini
{% endhighlight %}

重启apache服务

{% highlight bash %}
$ sudo apachectl restart
{% endhighlight %}

apache服务重启后，PHP就可以用了

可以用如下方法验证PHP是否启动

{% highlight bash %}
$ sudo cp /Library/WebServer/Documents/index.html.en /Library/WebServer/Documents/info.php
{% endhighlight %}

编辑PHP文件

{% highlight bash %}
$ sudo vi /Library/WebServer/Document/info.php
{% endhighlight %}

在It works！后面加上

{% highlight php %}
<?php phpinfo(); ?>
{% endhighlight %}

然后就可以在`http://localhost/info.php`中查看PHP相关信息了。

## mysql安装 {#install-mysql}

安装dmg版，先安装主文件，再安装MysqlStartupItem.pkg文件，该文件使mysql开机时自动启动，最后安装Mysql.prefPane文件，添加Mysql配置到系统偏好设置

通过运行sudo vi /etc/bashrc设置mysqlstart，mysql和mysqladmin的别名，方便使用

{% highlight bash %}
#mysql
alias mysqlstart='sudo /Library/StartupItems/MySQLCOM/MySQLCOM restart'
alias mysql='/usr/local/mysql/bin/mysql'
alias mysqladmin='/usr/local/mysql/bin/mysqladmin'
{% endhighlight %}

启动mysql后，使用下面命令改变mysql密码, 密码为123456

{% highlight bash %}
$ mysqladmin -u root password 123456
{% endhighlight %}

如果PHP无法连接mysql，并提示

<div class="bs-callout bs-callout-info">
	Can’t connect to local MySQL server through socket ‘/var/mysql/mysql.sock’
</div>

修改php.ini

	mysql.default_socket = /tmp/mysql.sock