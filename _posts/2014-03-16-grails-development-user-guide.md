---
layout: post
title: "Grails Development User Guide"
description: "Grails开发者手册"
category: Grails
tags: [grails]
---
在一般的开发流程中，我们通常是按照Domains->Controllers|Services(如果有必要的 话)->Views->UrlMappings这样的流程来开发。所以下面的章节将按照以上的顺序来对Grails做简单的介绍。更详细的 Grails介绍请参看[Grails User Guide](http://grails.org/doc/latest/guide/)

## 建立Domain类

### 基本属性

通过您喜欢的IDE或者是Grails提供的命令，我们可以很轻松地创建一个Domain类，这里我们只介绍通过Grails命令进行创建，使用如下命令可以创建一个helloworld包下名为User的Domain类

{% highlight bash %}
$ grails create-domain-class org.easycloud.wct.auth.User
{% endhighlight %}

<div class="alert alert-info">
<i class="fa fa-info-circle"><span class="sr-only">INFO</span></i> 如果不指定包名，Grails自动采用应用名作为包名
</div>

上述命令将会创建一个grails-app/domain/org/easycloud/wct/auth/User.groovy的文件，内容如下

{% highlight groovy %}
package org.easycloud.wct.auth
class User {
	static constraints = {
    }
}	
{% endhighlight %}

我们需要为User类添加若干个属性，例如：

{% highlight groovy %}
package helloworld
  
class User {
   	String login
   	String password
   	String firstName
   	String lastName
   	String email
   	String url
   	Long loginTimes
   	Date dateCreated
   	static constraints = {}
}
{% endhighlight %}

上面的Person类，我们为其添加了4个属性，ID是默认加入到Domain类的，所以我们这里不需担心。这样，Grails自动为我们在数据库中建立一个含有相应字段的表，后续我们会介绍如何自定义映射表的表名和列名。

### 基本的CRUD

#### Create

{% highlight groovy %}
import org.easycloud.wct.auth.User
def u = new User(login: 'admin', password: 'changeit', firstName: 'Ke', lastName: 'Meng', email: 'mengke@163.com', url: 'http://www.mengke.com', loginTimes: 0l)
u.save()
{% endhighlight %}

#### Read

{% highlight groovy %}
import org.easycloud.wct.auth.User
 
def u = User.get(1)
assert 1 == u.id
assert 'admin' == u.login
{% endhighlight %}

该方法将指定id的用户从数据库中读取出来，如果你需要一个只读的实体，你可以使用read方法

{% highlight groovy %}
def u = User.read(1)
{% endhighlight %}

在上面的语句中，Hibernate引擎不会记录u的脏状态，也不会将u持久化，此外，你可以通过load方法来load一个User实例的代理对象

{% highlight groovy %}
def u = User.load(1)
{% endhighlight %}

直到你调用了getId之类的方法前，上面语句不会立即访问数据库。

#### Update

{% highlight groovy %}
import org.easycloud.wct.auth.User
 
def u = User.get(1)
assert 'changeit' == u.password
u.password = 'admintest'
u.save()
 
def ut = User.get(1)
assert 'admintest' == u.password
{% endhighlight %}

#### Delete

{% highlight groovy %}
import org.easycloud.wct.auth.User
def u = User.get(1)
u.delete()
def ut = User.get(1)
assert null == ut
{% endhighlight %}

### 通过UI查看数据库

Grails内置了一个简单的数据库UI，它可以帮助我们方便的查看数据表以及操作相关测试数据（尤其是对于H2内存库），启动应用
并使用浏览器访问<http://localhost:8080/wct/dbconsole>
在JDBC URL项中填写对应环境的数据源，如当前开发环境

	jdbc:h2:mem:devDb;MVCC=TRUE;LOCK_TIMEOUT=10000

### Constraints

约束条件主要用于验证，常用的约束条件如下

* nullable: false即为该字段不能为空

<div class="alert alert-info">
<i class="fa fa-info-circle"><span class="sr-only">INFO</span></i> 所有字段默认都添加了nullable: false的约束
</div>

字符串常用约束条件

* blank: false即为该字符串字段不能为空串""

<div class="alert alert-info">
<i class="fa fa-info-circle"><span class="sr-only">INFO</span></i> 如果一个字段为null，它不会被blank: true验证通过，这种情况下，需要设置nullable: true. 另外，""会被转换成null，所以一般我们只需要设置nullable: false，即可保证该字符串字段为非空
<p/>
<p>如何保存一个空字符串（TBD）</p>
</div>

* email: true 该字段必须是一个email地址
* inList: ["one", "two", "three", "four"] 该字段必须是列表内字符串之一，另外如果我们不设置maxSize和size约束的话，该字段采用列表内字符串长度最长的长度作为该字段的最大长度，如本例即为5（”three“）
* matches: "[a-zA-Z]+" 该字段必须匹配给定正则
* maxSize: 20 该约束需要设置一个整数，指定对应字段的最大长度
* minSize 同maxSize，指定对应字段的最小长度
* size: 1..20 该约束需要设置一个整数范围，指定对应字段的长度范围
* unique: true 即为该字段值必须唯一
* url: true 该字段必须是一个url地址

数字以及日期等常用约束条件

* max: 20 该字段的值必须小于等于设定值20
* min: 2 该字段的值必须大于等于设定值2
* range: 2..20 该字段的值必须介于2到20之间

### 对象关系

#### 多对一和一对一

{% highlight groovy %}
class Face {
   	Nose nose
}
class Nose {
}	
{% endhighlight %}

上面的例子我们生成一个从Face到Nose的单向多对一映射，如果我们需要一个双向映射，可以按照参照如下例子

{% highlight groovy %}
class Face {
    Nose nose
}
class Nose {
   	static belongsTo = [face:Face]
}
{% endhighlight %}

上面的例子我们保存一个Face的话，它所携带的nose实例会被一起保存，当删除一个Face实例时，从属于它的nose会被一起删除。该例子中生成如下两个表：

---

Face:

<table class="table">
	<thead><tr><th>字段名</th><th>类型</th><th>备注</th></tr></thead>
	<tbody>
		<tr><td>ID</td><td>&nbsp;</td><td>&nbsp;</td></tr>
		<tr><td>VERSION</td><td>&nbsp;</td><td>&nbsp;</td></tr>
		<tr><td>NOSE_ID</td><td>&nbsp;</td><td>&nbsp;</td></tr>
	</tbody>
</table>

---

Nose:

<table class="table">
	<thead><tr><th>字段名</th><th>类型</th><th>备注</th></tr></thead>
	<tbody>
		<tr><td>ID</td><td>&nbsp;</td><td>&nbsp;</td></tr>
		<tr><td>VERSION</td><td>&nbsp;</td><td>&nbsp;</td></tr>
	</tbody>
</table>

### 实体继承关系

TBD

## 生成Controller
创建controller一般有两种方式，一种是create-controller，另外是根据已有的Domain类生成一个controller，前者grails会帮我们生成一个空白的controller，而后者会为指定的Domain类生成基本的CRUD action

### 命令行：
{% highlight groovy %}
$ grails create-controller book
$ grails generate-controller [domain class name]
{% endhighlight %}	
上面第一条语句会帮我们创建一个名为BookController的空白Controller类，而第二条语句会帮我们创建一个与Domain类对应的Controller，里面包含index，save，update，delete等方法。

### Intellij IDEA用户：

创建一个空白controller

<div class="alert alert-info">
Grails Views -> Controllers -> 右键Controllers -> New -> Grails Controllers -> 填写 org.easycloud.wct.Default -> OK -> 在org.easycloud.wct包下生成一个DefaultController
</div>

{% highlight groovy %}
package org.easycloud.wct
class DefaultController {
   	def index() {}
}
{% endhighlight %}

根据已有的Domain类生成Controller

<div class="alert alert-info">
Grails Views -> Domain Classes -> 双击打开需要生成Controller的Domain类（如Person） -> 点击编辑器上方导航栏中PersonController -> 点击Generate controller -> 在Controllers的Domain同名包下可以找到生成的Controller
</div>

当Domain类的Controller已经存在时，点击导航栏中的Controller按钮会自动定位到Controller类

### Eclipse(ggts)用户

创建一个空白Controller

<div class="alert alert-info">
右键Controllers -> 点击 Create Controller -> 填写Controller Name
</div>

根据已有的Domain类生成Controller

<div class="alert alert-info">
右键需要生成Controller的Domain类（如Person）-> 点击Generate Controller(或Generate Controller and Views，这会将Views一起创建)
</div>

### 自定义配置参数

在开发过程中，我们可能会需要添加各种自定义参数，比如图片上传路径，登录密码加密方式等，需要在Config.groovy中添加如下配置即可

{% highlight groovy %}
grails.demo.config1 = 'demo'
grails.demo.config2 = ['demo2', 'blahblah']
{% endhighlight %}

或

{% highlight groovy %}
grails {
   	demo {
    	config1 = 'demo1'
    	config2 = ['demo2', 'blahblah']
   	}
}
{% endhighlight %}

在上例中，grails.demo.config1为字符串类型，grails.demo.config2为数组类型

注意，你不能写成如下方式

<div class="alert alert-danger">
	{% highlight groovy %}
	grails.demo {
    	config1 = 'demo1'
    	config2 = ['demo2', 'blahblah']
	}
	{% endhighlight %}
	嵌套格式和"."不能混用
</div>

然后再Controllers中需要读取该参数的话，在action中使用如下语句读取

{% highlight groovy %}
def demoConfig1 = grailsApplication.config.grails.demo.config1
{% endhighlight %}

如果需要在Services中使用该参数，需要按如下方式读取

{% highlight groovy %}
class MyService {

   	def grailsApplication
 
   	String greeting() {
		def demoConfig1 = grailsApplication.config.grails.demo.config1
		return "Hello ${demoConfig1}"
   	}
}	
{% endhighlight %}

一般情况下我们需要针对不同的运行环境使用不同的配置，所以我们最好使用environment-based配置

{% highlight groovy %}
environments {
   	production {
       	grails {
           	demo {
               	config1 = 'demo1'
               	config2 = ['demo2', 'blahblah']
           	}
       	}
   	}
   	development {
       	grails {
           	demo {
               	config1 = 'devDemo1'
               	config2 = ['devDemo2', 'blahblah']
           	}
       	}
    }
    test {
       	grails {
           	demo {
               	config1 = 'testDemo1'
               	config2 = ['testDemo2', 'blahblah']
           	}
       	}
   	}
}
{% endhighlight %}

上述配置可以简化为

{% highlight groovy %}
grails {
   	demo {
       	environments {
           	production {
               	config1 = 'demo1'
               	config2 = ['demo2', 'blahblah']
           	}
           	development {
               	config = 'devDemo1'
               	config2 = ['devDemo2', 'blahblah']
           	}
           	test {
               	config = 'testDemo1'
               	config2 = ['testDemo2', 'blahblah']
           	}
       	}
   	}
}
// 读取方式仍然为
def demoConfig1 = grailsApplication.config.grails.demo.config1
{% endhighlight %}

<div class="alert alert-success">
<i class="fa fa-thumbs-up"><span class="sr-only">Recommends</span></i> 我们更推荐大家使用environment-based配置
</div>

## 生成Views

## 配置URLMappings

## Debug Mode

由于Grails 2.3.1启用了远程调试，所以传统基于JVM的Debug方式无法正常使用，下面使用如下方式启用Intellij的Debug功能
1. 配置一个Remote Debug：Toolbar -> Run/Debug -> Edit Configuration -> 左上角"+" -> Remote -> 配置Name（随便写），然后按下图配置Host和Port，并保存

<img src="/assets/img/remote-debug.png" class="img-thumbnail">

2. 使用Grails命令

{% highlight bash %}
$ grails run-app --debug-fork
{% endhighlight %}

或在Intellij界面中配置

<img src="/assets/img/run-app-grails.png" class="img-thumbnail">

Run/Debug Configuration 中得Command Line配置

<img src="/assets/img/debug-grails.png" class="img-thumbnail">

{% highlight bash %}
$ run-app --debug-fork
{% endhighlight %}

3. 启动项目，待到日志输出如下信息时

{% highlight bash %}
| Packaging Grails application...
| Packaging Grails application....
| Packaging Grails application.....
| Running Grails application
Listening for transport dt_socket at address: 5005
{% endhighlight %}

切换到配置好的Remote-Debug, 

<img src="/assets/img/run-remote.png" class="img-thumbnail">

点击debug即可。

Eclipse用户请按照官方文档创建Remote-Debug即可，其他步骤与Intellij相同

## Troubleshooting

> 启动Tomcat时，报java.lang.IncompatibleClassChangeError: the number of constructors during runtime and compile time for ... do not match. Expected ? but got ?
>> 该错误一般是由于包重复造成的，如果是部署在服务器的war包报此错，可以解压war包，查看其lib目录下groovy包是否有重复