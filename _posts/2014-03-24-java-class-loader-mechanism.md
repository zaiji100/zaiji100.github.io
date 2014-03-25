---
layout: post
title: "Java Class Loader Mechanism"
category: JDK
tags: [jdk, classloader, bootstrap, java]
---
类加载器（`ClassLoader`）用来将Java类加载到JVM中，一般情况下，Java编译器将语法等正确的Java源文件编译成可跨平台的JVM可以理解的字节码（class文件），`ClassLoader`负责将这些class文件从磁盘上加载到JVM，并形成一个`java.lang.Class`的一个实例。而一个Java应用中所有的类都是由该类的一个实例表示的。为了完成这一职责，`ClassLoader`提供了一系列比较重要的方法。

<table class="table">
	<thead>
		<tr><th>方法</th><th>说明</th></tr>
	</thead>
	<tbody>
		<tr><td>getParent()</td><td>返回该类加载器的父类加载器</td></tr>
		<tr><td>loadClass(String name)</td><td>加载名称为name的类，返回结果是一个<code>java.lang.Class</code>实例</td></tr>
		<tr><td>findClass(String name)</td><td>查找名称为name的类，返回结果是一个<code>java.lang.Class</code>实例</td></tr>
		<tr><td>findLoadedClass(String name)</td><td>查找名称为name的已经被加载的类，返回结果是一个<code>java.lang.Class</code>实例</td></tr>
		<tr><td>defineClass(String name, byte[] b, int off, int len)</td><td>把字节数组b中的内容转换为一个<code>java.lang.Class</code>实例，该方法是final的</td></tr>
		<tr><td>resolveClass(Class&lt;?&gt; c)</td><td>链接指定的class</td></tr>
	</tbody>
</table>

一般来说，如果需要实现自己的类加载器，只需要实现`findClass`方法即可，`loadClass`封装了下面提到的委托机制。

## 类加载器的树状组织结构 {#class-loader-tree-architecture}

Java中的类加载器大致可以分为两种类型，系统提供的和用户自己实现的。而系统实现的类加载器共有3个：

* 引导类加载器（bootstrap class loader）：它用来加载java的核心库，是利用原生代码实现的。并**不继承**自`java.lang.ClassLoader`。
* 扩展类加载器（extensions class loader）：它用来加载java的扩展库。Java虚拟机中会提供一个扩展库目录，该`ClassLoader`会在此目录中查找并加载Java类
* 系统类加载器（system class loader）：它通过查找Java应用提供的类路径（`CLASSPATH`）来加载Java类，一般来说，除了核心库，Java应用大部分类都是有该加载器加载的。

除了系统提供的ClassLoader，开发人员可以通过继承java.lang.ClassLoader的方式来实现自己的类加载器。

JVM中所有类加载器都是以父子树形结构组织起来的，除了引导类加载器外，所有类加载器都有一个父类加载器，通过getParent方法获得。对于系统提供的类加载器，扩展类加载器的父类加载器是引导类加载器，系统类加载器的父类加载器是扩展类加载器。对于用户自定义的类加载器来说，加载了该类加载器的类加载器是其父类加载器，一般来说就是系统类加载器。

<div class="alert alert-danger">TBD 插图</div>

## 类加载器的委托机制 {#class-loader-depute}

`ClassLoader`除了树状组织结构这一特性外，`ClassLoader`还有另外一项特性，就是委托机制。`ClassLoader`在尝试自己去查找定义某个类时，会先委托给其父类加载器，由父类加载器负责尝试加载这个类，以此类推。在JVM加载了第一个类A（比如main方法所在类）后，而类A引用了类B；加载了类A的类加载器CL1会启动类B的加载过程，而假设类B是一个Java中的核心类，那么最终完成加载这个过程的类加载器CL2其实是引导类加载器。而对于类B而言，类加载器CL1是其初始加载器（Initiating loader），类加载器CL2是定义加载器（defining loader）。真正的加载过程是由`defineClass`这个方法来实现的，而启动这个过程是由`loadClass`来实现的。由初始加载器调用`loadClass`方法，而由定义加载器负责调用`defineClass`。

<div class="bs-callout bs-callout-info">
在JVM中，判断两个类是否是同一个类，取决于定义加载器是否一致。这两种加载器的关联之处在于：如果类A中引用了类B，那么类A的定义加载器是类B的初始加载器。当一个类加载器成功加载某个类后，会将这个java.lang.Class实例缓存起来。下次再次请求加载此类时，会先去缓存中查找是否有该实例。也就是说，对于一个类加载器来说，相同全名的类只会被加载一次，以后对其的请求都会从缓存中获取。
</div>

`loadClass`方法抛出的是`java.lang.ClassNotFoundException`异常，而`defineClass`方法抛出的是`java.lang.NoClassDefFoundException`，根据这两个异常，能够帮助开发人员更迅速的定位问题。

为什么JVM要实现这样的一个委托机制呢？它能帮我们解决什么样的问题？Java默认提供了很多类，比如`java.lang.String`，如果我们在自己的代码中也定义了一个`java.lang.String`，假设没有上述机制会怎么样呢？它会由Java应用的类加载器，也就是系统类加载器负责进行加载，这样的话，加载到内存的是我们自己定义的`java.lang.String`，这对与JVM来说风险极大，任何人都可以提供同名类来覆盖系统提供的类。而使用类加载器的向上委托机制情况就有所不同了，当我们需要加载`java.lang.String`，类加载器会逐步向上委托直至引导类加载器，这样保证真正加载到内存的是Java提供的`java.lang.String`。

## 线程上下文类加载器 {#thread-context-class-loader}

首先我们可以通过`Thread.setContextClassLoader(ClassLoader cl)`以及`Thread.getContextClassLoader()`设置和获取线程的上下文类加载器。如果没有通过`setContextClassLoader`设置当前线程的上下文类加载器，那么默认继承父线程的上下文类加载器。Java程序初始线程的默认上下文类加载器是系统类加载器。那么为什么会出现线程上下文类加载器呢？它是用来解决什么问题的呢？

类加载器的委托机制并不能为我们解决所有问题。例如，Java中提供了大量的SPI，允许第三方提供实现，比如常见的有JDBC，JNDI等。这些SPI接口都定义在Java核心库，而它们的实现类一般都以第三方包的形式包含进来，通过CLASSPATH进行查找。比如说JDBC，它的接口定义在java.sql中，是核心库的一部分；而实现了它的Mysql JDBC Driver，则是以第三方包的形式提供的。但问题是JDBC接口是由引导类加载器负责加载的，再由它来加载JDBC实现时，它是找不到JDBC实现类的。它也不能将其委托给系统类加载器，因为它是系统类加载器的祖先类加载器。

线程上下文类加载器可以很好的解决这个问题。默认情况下，线程的上下文类加载器是系统类加载器，在JDBC中使用上下文类加载器就可以成功加载第三方JDBC实现。

## Class.forName

`Class.forName`是一个静态方法，同样可以用来加载类。该方法有两种形式：`Class.forName(String name, boolean initialize, ClassLoader loader)`和 `Class.forName(String className)`。第一种形式的参数 `name`表示的是类的全名；`initialize`表示是否初始化类；`loader`表示加载时使用的类加载器。第二种形式则相当于设置了参数 `initialize`的值为 true，`loader`的值为当前类的类加载器。`Class.forName`的一个很常见的用法是在加载数据库驱动的时候。如`Class.forName("org.apache.derby.jdbc.EmbeddedDriver").newInstance()`用来加载 Apache Derby 数据库的驱动。

## 开发自己的类加载器 {#define-your-own-classloader}

先来看一个从文件系统中查找并加载Java类的例子：

{% highlight java %}
public class FileSystemClassLoader extends ClassLoader {
 
    private String rootDir;
 
    public FileSystemClassLoader(String rootDir) {
        this.rootDir = rootDir;
    }
 
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        byte[] classData = getClassData(name);
        if (classData == null) {
            throw new ClassNotFoundException();
        }
        else {
            return defineClass(name, classData, 0, classData.length);
        }
    }
 
    private byte[] getClassData(String className) {
        String path = classNameToPath(className);
        try {
            InputStream ins = new FileInputStream(path);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            int bufferSize = 4096;
            byte[] buffer = new byte[bufferSize];
            int bytesNumRead = 0;
            while ((bytesNumRead = ins.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesNumRead);
            }
            return baos.toByteArray();
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }
 
    private String classNameToPath(String className) {
        return rootDir + File.separatorChar
                + className.replace('.', File.separatorChar) + ".class";
    }
 }
 {% endhighlight %}

 一般来说，开发者只需要重写`findClass`就可以实现自己的类加载器，`ClassLoader.loadClass`实现了我们上面提到的委托机制，它首先会调用`findLoadedClass`方法在缓存中查找是否已加载过此类，如果没有的话，则调用父类加载器的`loadClass`来尝试加载此类。所以如果希望上述委托机制正确执行的话，最好重写`findClass`，而不是`loadClass`。

## Web容器中的类加载机制 {#classloader-in-j2ee}

在J2EE所提倡的标准中，类加载器也需要使用委托机制，但和一般Java应用不同的是，Web容器使用向下委托机制，也就是说优先使用用户提供的同名类。但对于核心库是例外，这也保证了Java核心库的类型安全。

绝大多数情况下，Web 应用的开发人员不需要考虑与类加载器相关的细节。下面给出几条简单的原则：

* 每个 Web 应用自己的 Java 类文件和使用的库的 jar 包，分别放在 `WEB-INF/classes`和 `WEB-INF/lib`目录下面。
* 多个应用共享的 Java 类文件和 jar 包，分别放在 Web 容器指定的由所有 Web 应用共享的目录下面。
* 当出现找不到类的错误时，检查当前类的类加载器和当前线程的上下文类加载器是否正确。