---
layout: post
title: "Scala Related"
category: Scala
tags: [scala, grammar]
---
## 基本语法 {#basic-grammar}

### val 类似于java中final变量，一经定义初始化后，就不能改变

{% highlight scala %}
val msg = "Hello, world!"
{% endhighlight %}

### var 定义一般变量，允许其值发生改变

{% highlight scala %}
var greeting = "Hello, world!"
{% endhighlight %}

### 定义函数

{% highlight scala %}
def max(x: Int, y: Int): Int = {
  if (x > y) x
  else y
}
{% endhighlight %}

当函数体只有一行时，可以简写成如下形式

{% highlight scala %}
def max2(x: Int, y: Int) = if (x > y) x else y
{% endhighlight %}

所有函数都通过`def`关键词来定义，接下来`max`是函数名，()中是参数列表，x和y是参数名，其对应的类型，通过:分割，参数列表后紧跟:返回值类型，然后是＝函数体

{% highlight scala %}
// 定义一个无参无返回值的函数
def greet() = println("Hello, world!") 
// greet: ()Unit
{% endhighlight %}

greet:后括号代表无参数，`Unit`代表没有返回值，类似于java中的`void`

### scala脚本

{% highlight scala %}
// hello.scala
println("Hello, world, from a script!")
{% endhighlight %}

使用 `$ scala hello.scala` 运行，结果显示

<div class="bs-console">
Hello, world, from a script!
</div>

{% highlight scala %}
// helloarg.scala
// Say hello to the first argument
println("Hello, "+ args(0) +"!")
{% endhighlight %}

使用 `$ scala helloarg.scala planet` 运行 `planet`是传递给脚本的参数，结果显示

<div class="bs-console">
Hello, planet!
</div>

## 循环和条件(Loop and Condition) {#loop-and-condition}

{% highlight scala %}
var i = 0
while (i < args.length) {
  println(args(i))
  i += 1
}
 
var i = 0
while (i < args.length) {
  if (i != 0)
    print(" ")
  print(args(i))
  i += 1
}
println()
{% endhighlight %}

然而这并不是scala的风格，而是类似于java，C等语言的风格

下面是使用`foreach`完成循环功能

{% highlight scala %}
args.foreach(arg => println(arg))
{% endhighlight %}

在上面的代码块中，args是一个列表／数组对象，`foreach`方法中，可以认为是你传递了一个匿名的函数（function literal），它以arg为参数，`println(arg)`为函数体

<div class="bs-callout bs-callout-info">
	<h4>function literal</h4>
	<p>A function with no name in Scala source code, specified with function literal syntax. For example, (x: Int, y: Int) => x + y.</p>
</div>

Scala解析器默认将`arg`当作`String`类型，如果你需要明确指定，可以采用下面语句

{% highlight scala %}
args.foreach((arg: String) => println(arg))
{% endhighlight %}

如果你希望语句更简洁，当匿名函数的方法体只有一条语句，而且该语句只接收一个参数时，函数可以不指定函数名和参数，上述代码可以改写成下面形式

{% highlight scala %}
args.foreach(println)
{% endhighlight %}

再看另外一个例子

{% highlight scala %}
for (arg <- args)
  println(arg)
{% endhighlight %}

&lt;-符号右边的args是列表／数组，而<-符号左边的`arg`是一个`val`，而不是`var`，由于它一直是一个`val`，所以只需要写成`arg`即可。

## 数组(Array) {#array}

在Scala中，你可以用`new`关键词来实例化对象，类实例等，在实例化时，我们可以使用值和类型来初始化它。例如下面例子

{% highlight scala %}
val big = new java.math.BigInteger("12345")
{% endhighlight %}

上面语句实例化了一个java实例`java.math.BigInteger`，并且使用“12345”来初始化它。

{% highlight scala %}
// Example 6.1
val greetStrings = new Array[String](3)
   
greetStrings(0) = "Hello"
greetStrings(1) = ", "
greetStrings(2) = "world!\n"
   
for (i <- 0 to 2)
  print(greetStrings(i))
{% endhighlight %}

上面例子中，`greetStrings`是一个`Array[String]`类型（an "array of string"）的实体，并且使用3来初始化该实体，表明该数组的长度为3，

如果你希望明确指定greetStrings的类型，可以使用如下语句

{% highlight scala %}
val greetStrings: Array[String] = new Array[String](3)
{% endhighlight %}

在Example 6.1接下来三行，为`greetStrings`填充数据，和Java不同的是，`greetStrings(0) = "Hello"`，Scala使用了圆括号()，而不是方括号[]，由于`greetStrings`是一个`val`变量，所以它是不能变化的，你不能将它重新赋予另外一个不同的数组，但你可以改变它元素的值，数组本身是可变的。
接下来最后两行，第一行中显示了Scala的一个重要的规则，如果一个方法只接收一个参数，你可以不用点和括号来调用，在这个例子中，`0 to 2`可以转换成`(0).to(2)`，`to`方法是`Int`实体0的一个方法，它接收一个`Int`参数(2)

<div class="alert alert-warning">
	<i class="fa fa-exclamation-triangle">&nbsp;</i> 注意，该语法只能用在明确指定了方法的拥有者，例如你不能使用类似与“print 10”的语句，但是“Console print 10”是合法的
</div>

Scala从技术上讲是没有操作符重载的，因为它没有传统意义上的操作符。而类似于+,-,&#42;和/等符号都可以作为方法名，当你使用`1+2`的语句时，你实际上是在调用Int对象1的+方法，而2是传递给该方法的参数。所以可以将1+2改写为方法调用的形式，`(1).+(2)`

另外一个重要的特性表明了数组的访问为什么不是用方括号，而是用圆括号。当你在一个对象或实例上使用圆括号时，并为它传递了1个或多个参数，类似于`greetStrings(1)`，Scala会将该语句转化成`greetStrings.apply(1)`，所以在Scala中，数组的元素访问实际上也是一个方法调用。类似的，

{% highlight scala %}
greetStrings(0) = "Hello"
{% endhighlight %}

可以转化为

{% highlight scala %}
greetStrings.update(0, "Hello")
{% endhighlight %}

上面Example 6.1可以转化为方法调用的形式：

{% highlight scala %}
val greetStrings = new Array[String](3)
   
greetStrings.update(0, "Hello")
greetStrings.update(1, ", ")
greetStrings.update(2, "world!\n")
   
for (i <- 0.to(2))
  print(greetStrings.apply(i))
{% endhighlight %}

另外Scala还提供了数组的初始化的简单形式，

{% highlight scala %}
val numNames = Array("zero", "one", "two")
{% endhighlight %}

上面语句中，`Array`实际上是一个名为`Array`的`object`，而不是类实例，而上面语句实际上是调用的`Array`对象的`apply`方法，该方法是一个工厂方法，实例化了一个`Array`类型的实体，并返回该实体。该`apply`方法接收一系列的值用于填充数组。上面语句还可以改写为

{% highlight scala %}
val numNames2 = Array.apply("zero", "one", "two")
{% endhighlight %}

## 列表(List) {#list}

{% highlight scala %}
val oneTwoThree = List(1, 2, 3)
{% endhighlight %}

上面已经提到，Scala中的数组`Array`是可变的，而列表`List`是不可变的，这一点与Java中的`List`不同，Java中的`List`是可变的。

{% highlight scala %}
val oneTwo = List(1, 2)
val threeFour = List(3, 4)
val oneTwoThreeFour = oneTwo ::: threeFour
println(""+ oneTwo +" and "+ threeFour +" were not mutated.")
println("Thus, "+ oneTwoThreeFour +" is a new list.")
{% endhighlight %}

运行这段代码，结果是在屏幕上打印

<div class="bs-console">
	<p>List(1, 2) and List(3, 4) were not mutated.</p>
	<p>Thus, List(1, 2, 3, 4) is a new list.</p>
</div>

由于`List`是不可变的，所以它的行为`String`比较类似。List拥有一个名为`“:::”`的方法，它将创建一个新的`List`并将两个`List`的内容依次填充到新`List`中

另外一个`List`常用的方法是`“::”`

{% highlight scala %}
val twoThree = List(2, 3)
val oneTwoThree = 1 :: twoThree
println(oneTwoThree)
{% endhighlight %}

程序运行结果是

<div class="bs-console">
	List(1, 2, 3)
</div>

`“::”`方法是在List前添加一个元素，在上面例子里就是在twoThree添加一个元素1。`“::”`是一个右运算符，它的拥有者是方法右边的twoThree，而不是1。有一个简单的规则来，如果一个方法被当作操作符来使用，那么它是从左到右调用，如`a * b`，就是`a.*(b)`，而当方法以`":"`结尾时，该方法从右往左调用，如下面例子，输出结果同上面的例子，`Nil`是一个空列表，再其前面依次添加3，2，1，最后形成List(1,2,3)，`":::"`也是从右向左调用。

{% highlight scala %}
val oneTwoThree = 1 :: 2 :: 3 :: Nil
println(oneTwoThree)
{% endhighlight %}

一些List的方法和应用

<table class="table">
	<thead>
		<tr><th>What is it?</th><th>What it does?</th></tr>
	</thead>
	<tbody>
		<tr><td>List() or Nil</td><td>The empty List</td></tr>
		<tr><td>List("Cool", "tools", "rule")</td><td>Creates a new List[String] with the three values "Cool", "tools", and "rule"</td></tr>
		<tr><td>val thrill = "Will" :: "fill" :: "until" :: Nil</td><td>Creates a new List[String] with the three values "Will", "fill", and "until"</td></tr>
		<tr><td>List("a", "b") ::: List("c", "d")</td><td>Concatenates two lists (returns a new List[String] with values "a", "b", "c", and "d")</td></tr>
		<tr><td>thrill(2)</td><td>Returns the element at index 2 (zero based) of the thrill list (returns "until")</td></tr>
		<tr><td>thrill.count(s => s.length == 4)</td><td>Counts the number of string elements in thrill that have length 4 (returns 2)</td></tr>
		<tr><td>thrill.drop(2)</td><td>Returns the thrill list without its first 2 elements (returns List("until"))</td></tr>
		<tr><td>thrill.dropRight(2)</td><td>Returns the thrill list without its rightmost 2 elements (returns List("Will"))</td></tr>
		<tr><td>thrill.exists(s => s == "until")</td><td>Determines whether a string element exists in thrill that has the value "until" (returns true)</td></tr>
		<tr><td>thrill.filter(s => s.length == 4)</td><td>Returns a list of all elements, in order, of the thrill list that have length 4 (returns List("Will", "fill"))</td></tr>
		<tr><td>thrill.forall(s => s.endsWith("l"))</td><td>Indicates whether all elements in the thrill list end with the letter "l" (returns true)</td></tr>
		<tr><td>thrill.foreach(s => print(s))</td><td>Executes the print statement on each of the strings in the thrill list (prints "Willfilluntil")</td></tr>
		<tr><td>thrill.foreach(print)</td><td>Same as the previous, but more concise (also prints "Willfilluntil")</td></tr>
		<tr><td>thrill.head</td><td>Returns the first element in the thrill list (returns "Will")</td></tr>
		<tr><td>thrill.init</td><td>Returns a list of all but the last element in the thrill list (returns List("Will", "fill"))</td></tr>
		<tr><td>thrill.isEmpty</td><td>Indicates whether the thrill list is empty (returns false)</td></tr>
		<tr><td>thrill.last</td><td>Returns the last element in the thrill list (returns "until")</td></tr>
		<tr><td>thrill.length</td><td>Returns the number of elements in the thrill list (returns 3)</td></tr>
		<tr><td>thrill.map(s => s + "y")</td><td>Returns a list resulting from adding a "y" to each string element in the thrill list (returns List("Willy", "filly", "untily"))</td></tr>
		<tr><td>thrill.mkString(", ")</td><td>Makes a string with the elements of the list (returns "Will, fill, until")</td></tr>
		<tr><td>thrill.remove(s => s.length == 4)</td><td>Returns a list of all elements, in order, of the thrill list except those that have length 4 (returns List("until"))</td></tr>
		<tr><td>thrill.reverse</td><td>Returns a list containing all elements of the thrill list in reverse order (returns List("until", "fill", "Will"))</td></tr>
		<tr><td>thrill.sort((s, t) => s.charAt(0).toLowerCase &lt; t.charAt(0).toLowerCase)</td>
		<td>Returns a list containing all elements of the thrill list in alphabetical order of the first character lowercased (returns List("fill", "until", "Will"))</td></tr>
		<tr><td>thrill.tail</td><td>Returns the thrill list minus its first element (returns List("fill", "until"))</td></tr>
	</tbody>
</table>

## 元组(Tuple) {#tuple}

另外一个有用的容器类型是元组tuple。类似于List，元组是不可变的，但和`List`不同的是`Tuple`可以存放不同类型的数据，而`List[Int]`只能存放`Int`类型的数据，`Tuple`在你希望在一个方法中返回多个值时，比较有用。在Java中，如果你希望返回多个值，你可能会创建一个Java Bean来保存这几个值，然后方法返回该Bean，但在Scala中你只需要使用`Tuple`即可，一旦创建了`Tuple`，你可以***使用基于1的顺序索引***访问`Tuple`的元素。

{% highlight scala %}
val pair = (99, "Luftballons")
println(pair._1)
println(pair._2)
{% endhighlight %}

第一行构建了一个`Tuple`，它有两个元素，一个是`Int`类型的99，一个`String`类型的Luftballons，第二行代码中的“.”与方法调用和属性访问时的"."一致，`_1`和`_2`是元组pair的两个字段，你可以通过`pairt._1`的形式来访问对应字段。一个`Tuple`的类型实际上取决于元素的个数和元素的类型，(99, "Luftballons")的实际类型是`Tuple2[Int, String]`，另外，这里访问元组元素的方式不和List一样，采用`list(7)`，是由于`apply`方法总是返回相同类型的值，而元组内的元素类型不一致，所以采用了字段访问的方式。

## Set and Map

## Case Classes

当定义一个`case class`时，scala编译器会自动做以下事情：

* 构造方法中得每一个参数都会默认被声明为`val`, 除非你显式声明为`var`（不建议）
* `apply`方法自动被添加到伴生对象中，这样，你可以使用`People("mengke", "M")`来构建实例，而不必使用`new`
* 提供一个`unapply`方法用于pattern match
* 提供`toString`, `equals`, `hashCode`以及`copy`方法

## Scala程序开发人员的态度 {#the-attitude-of-developer}

<div class="alert alert-info">
	<i class="fa fa-exclamation-circle">&nbsp;</i> 注意，该语法只能用在明确指定了方法的拥有者，例如你不能使用类似与“print 10”的语句，但是“Console print 10”是合法的
</div>