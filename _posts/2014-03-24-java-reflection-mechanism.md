---
layout: post
title: "Java Reflection Mechanism"
category: JDK
tags: [jdk, reflection, java]
---
Java反射机制是为了让开发人员在运行时也能灵活地操作某个类及其对象。正如其名，利用Java反射机制就好像看一个Java类在水中的倒影一般。

## Java 反射机制功能介绍

Java反射机制主要提供了以下几个功能：

* 运行时判断一个对象所属的类
* 运行时构造任意一个类的对象
* 运行时判断任意一个类的成员变量和方法
* 运行时调用任意一个对象的方法

所有Java类都继承自Object，而Object中定义了一个getClass方法，所有对象都可以通过调用该方法来获取当前对象所属的类，返回是一个Class的实例，调用该实例的getSuperClass方法，可以获取到该类的父类。

## 使用示例 {#samples}

对于任意一个拥有无参构造方法的类型，都可以使用Class.newInstance()来获取该类型的一个实例，但是对于那些没有默认构造方法的类型，构造方式稍微有点复杂。

{% highlight java %}
class MyClass {
    public int count;
    public MyClass(int start) {
        count = start;
    }
    public void increase(int step) {
        count = count + step;
    }
}
{% endhighlight %}

对于上面一个有参构造器的类型来说，它要以如下方式来构造，包括调用该实例的方法以及访问成员变量。

{% highlight java %}
MyClass myClass = new MyClass(0); //一般做法
myClass.increase(2);
System.out.println("Normal -> " + myClass.count);
try {
    Constructor constructor = MyClass.class.getConstructor(int.class); //获取构造方法
    MyClass myClassReflect = constructor.newInstance(10); //创建对象
    Method method = MyClass.class.getMethod("increase", int.class);  //获取方法
    method.invoke(myClassReflect, 5); //调用方法
    Field field = MyClass.class.getField("count"); //获取域
    System.out.println("Reflect -> " + field.getInt(myClassReflect)); //获取域的值
} catch (Exception e) {
    e.printStackTrace();
}
{% endhighlight %}

## 总结 {#summary}

<div class="bs-callout bs-callout-info">
	上面说到反射机制类似于观察Java类在水中的倒影，可以方便的访问该类的内部结构。我觉得此外还有一层含义，一般来说，我们需要new一个Class得到一个实例obj，通过调用obj.xxx方法来完成某项工作。而通过反射，我们使用Class来获取xxx方法，得到该方法的一个实例，然后再将该实例应用到obj。所谓反射即将obj主动调用xxx方法反射为xxx方法应用到obj也。
</div>

<div class="bs-callout bs-callout-info">
	通过调用Field或Method的setAccessible方法来设置该字段或方法是否可以被访问。可以使用它来绕过Java的访问控制机制。
</div>

<div class="bs-callout bs-callout-info">
	在Class的诸多方法中，有诸如getXXX以及getDeclaredXXX，它们的区别在于getDeclaredXXX只返回该类自身定义的成员变量和方法，继承自父类的成员变量和方法不返回。
</div>