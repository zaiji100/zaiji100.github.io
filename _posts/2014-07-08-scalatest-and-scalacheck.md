---
layout: post
title: "ScalaTest and ScalaCheck"
category: scala
tags: [scala, unit tests]
---

ScalaCheck是基于属性声明和测试数据自动化生成的Scala和Java程序的测试工具。它的基本理念是对方法或代码单元的预期行为声明属性,然后会检查这些声明的属性能通过测试。ScalaCheck以随机方式自动生成所有的测试数据，因此测试者不必担心任何遗漏的测试用例。

使用ScalaTest，我们可以测试我们的Scala代码和Java代码；它提供了Junit，TestNG，ScalaCheck以及EasyMock等常见的测试工具，ScalaTest提供了多种代码风格可供我们选择

## ScalaTest Styles

### FunSuite

近似于Junit的样式, 并且能够生成Specification形式的测试输出

{% highlight scala %}
import org.scalatest.FunSuite

class SetSuite extends FunSuite {

  test("An empty Set should have size 0") {
    assert(Set.empty.size == 0)
  }

  test("Invoking head on an empty Set should produce NoSuchElementException") {
    intercept[NoSuchElementException] {
      Set.empty.head
    }
  }
}
{% endhighlight %}

### FlatSpec

从xUnit迁移到BDD最简单的形式，和xUnit仍然很相像。但是测试名必须行为"A should B"

{% highlight scala %}
import org.scalatest.FlatSpec

class SetSpec extends FlatSpec {

  "An empty Set" should "have size 0" in {
    assert(Set.empty.size == 0)
  }

  it should "produce NoSuchElementException when head is invoked" in {
    intercept[NoSuchElementException] {
      Set.empty.head
    }
  }
}
{% endhighlight %}

### FunSpec

对于Ruby的RSpecs的用户来说，可能更喜欢该种形式

{% highlight scala %}
import org.scalatest.FunSpec

class SetSpec extends FunSpec {

  describe("A Set") {
    describe("when empty") {
      it("should have size 0") {
        assert(Set.empty.size == 0)
      }

      it("should produce NoSuchElementException when head is invoked") {
        intercept[NoSuchElementException] {
          Set.empty.head
        }
      }
    }
  }
}
{% endhighlight %}

### WordSpec

对于Specs和Specs2的用户来说，可能更喜欢该种形式

{% highlight scala %}
import org.scalatest.WordSpec

class SetSpec extends WordSpec {

  "A Set" when {
    "empty" should {
      "have size 0" in {
        assert(Set.empty.size == 0)
      }

      "produce NoSuchElementException when head is invoked" in {
        intercept[NoSuchElementException] {
          Set.empty.head
        }
      }
    }
  }
}
{% endhighlight %}

### FreeSpec

{% highlight scala %}
import org.scalatest.FreeSpec

class SetSpec extends FreeSpec {

  "A Set" - {
    "when empty" - {
      "should have size 0" in {
        assert(Set.empty.size == 0)
      }

      "should produce NoSuchElementException when head is invoked" in {
        intercept[NoSuchElementException] {
          Set.empty.head
        }
      }
    }
  }
}
{% endhighlight %}

### Spec

{% highlight scala %}
import org.scalatest.Spec

class SetSpec extends Spec {

  object `A Set` {
    object `when empty` {
      def `should have size 0` {
        assert(Set.empty.size == 0)
      }

      def `should produce NoSuchElementException when head is invoked` {
        intercept[NoSuchElementException] {
          Set.empty.head
        }
      }
    }
  }
}
{% endhighlight %}

### PropSpec

{% highlight scala %}
import org.scalatest._
import prop._
import scala.collection.immutable._

class SetSpec extends PropSpec with TableDrivenPropertyChecks with Matchers {

  val examples =
    Table(
      "set",
      BitSet.empty,
      HashSet.empty[Int],
      TreeSet.empty[Int]
    )

  property("an empty Set should have size 0") {
    forAll(examples) { set =>
      set.size should be (0)
    }
  }

  property("invoking head on an empty set should produce NoSuchElementException") {
    forAll(examples) { set =>
       a [NoSuchElementException] should be thrownBy { set.head }
    }
  }
}
{% endhighlight %}

### FeatureSpec

{% highlight scala %}
import org.scalatest._

class TVSet {
  private var on: Boolean = false
  def isOn: Boolean = on
  def pressPowerButton() {
    on = !on
  }
}

class TVSetSpec extends FeatureSpec with GivenWhenThen {

  info("As a TV set owner")
  info("I want to be able to turn the TV on and off")
  info("So I can watch TV when I want")
  info("And save energy when I'm not watching TV")

  feature("TV power button") {
    scenario("User presses power button when TV is off") {

      Given("a TV set that is switched off")
      val tv = new TVSet
      assert(!tv.isOn)

      When("the power button is pressed")
      tv.pressPowerButton()

      Then("the TV should switch on")
      assert(tv.isOn)
    }

    scenario("User presses power button when TV is on") {

      Given("a TV set that is switched on")
      val tv = new TVSet
      tv.pressPowerButton()
      assert(tv.isOn)

      When("the power button is pressed")
      tv.pressPowerButton()

      Then("the TV should switch off")
      assert(!tv.isOn)
    }
  }
}
{% endhighlight %}