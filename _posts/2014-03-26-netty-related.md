---
layout: post
title: "Netty Related"
category: Netty
tags: [netty, NIO]
---
## Transports

> Netty中共提供4种Transport
>
> * **非阻塞** `io.netty.channel.socket.nio`
> * **阻塞**   `io.netty.channel.socket.oio`
> * **本地**   `io.netty.channel.local`      并不发生真正的socket通信，消息在JVM中传递，并且所有操作是非阻塞的.
> * **嵌入式** `io.netty.channel.embedded`    主要用于测试

在非阻塞的transport中，`EventLoop`会循环处理不同的事件（包括handler中的各种业务代码），在handler中是不能做阻塞操作的。因为这会阻塞当前`EventLoop`， 而导致该`EventLoop`无法及时处理其他事件。而如果必须要执行阻塞操作的话，Netty提供了一种方式：在添加`ChannelHandlers`时，为`ChannelPipeline`指定一个`EventExecutorGroup`，该`EventExecutorGroup`会获取一个`EventExecutor`实例，该实例会使用不同的线程去执行handler中所有的方法；另外，在客户端预期并发连接较小的情况下，使用阻塞的transport的话，也可以暂时解决这类问题。因为每一个`EventLoop`绑定在一个固定的`Thread`中，而该`EventLoop`会始终处理这一个连接。

<div class="bs-callout bs-callout-info">
	<p>NIO transport中提供了一个其他transport所不具备的功能，就是快速从本地文件中传输到remote peer，该功能不需要将本地文件读取到用户内存。如果需要使用该功能，文件不能加密／压缩</p>
</div>

### Use Cases

> * NIO 在用户代码中没有阻塞操作，或者可以将它们限制在一个比较少的情况下，使用NIO无疑是最明智的。NIO transport可以处理大量并发连接，同时处理少量并发连接也是很好的。
> * OIO 在遗留代码中存在大量的阻塞操作（如利用JDBC获取数据库连接），而在短期内无法将其迁移到非阻塞模式时，可以暂时使用OIO代替，待非阻塞模式开发完成再迁移到NIO
> * LOCAL 如果你的代码中不需要进行网络通信，而是同一个JVM下的通信，那么使用LOCAL方式是不错的选择。而由于业务的增长，可能需要扩展到网络通信，此时，你也可以很轻松的将你的netty－based的代码迁移到前两种方式
> * EMBEDDED 测试你的ChannelHandler

## ByteBuf

> 相比于JDK的`ByteBuffer`, Netty提供的`ByteBuf`具有以下优点:
>
> * 可以定义自己的Buffer实现
> * 如果需要将多个个ByteBuf合并在一起，内置的`CompositeByteBuf`可以通过zero copy实现这个feature，而使用JDK的`ByteBuffer`的话，必须重新创建一个`ByteBuffer`，将需要合并的`ByteBuffer`全部都copy到新`ByteBuffer`中去。
> * Buffer容量可以按需扩充
> * 不需要调用`flip`来切换读/写模式
> * 读写索引分离
> * Reference counting
> * Pooling

### ByteBuf与ByteBuffer实现的区别

`ByteBuffer`中除了`position`，`limit`，`capacity`，还有`mark`索引，调用`mark`方法，`mark`索引更新为`position`，做完其他操作后，调用`reset`方法，可以将`position`还原为`mark`位置。
`ByteBuf`中拥有`markedReaderIndex`, `markedWriterIndex`索引，可以调用相应的mark和reset方法实现相应的功能。

#### ByteBuffer

	  +-------------------+------------------------------+------------------+
      | compactable bytes |  readable or writable bytes  |                  |
      |                   |           (CONTENT)          |                  |
      +-------------------+------------------------------+------------------+
      |                   |                              |                  |
      0      <=        position          <=            limit    <=      capacity

<div class="bs-callout bs-callout-info">
	<code>capacity</code>永远都不会变
</div>

---

1.新建一个初始状态的`ByteBuffer`，`position`为0，`limit`为`capacity`

      +---------------------------------------------------------------------+
      |                             writable bytes                          |
      |                                                                     |
      +---------------------------------------------------------------------+
      |                                                                     |
      position                           <=                               limit
      0                                                                  capacity

2.向`ByteBuffer`中写入数据后，`position`增加，但不能超过`limit`

      +----------------------------------------------+----------------------+
      |                                              |    writable bytes    |
      |                                              |                      |
      +----------------------------------------------+----------------------+
      |                                              |                      |
      0                     <=                   position      <=         limit
                                                                         capacity

3.写入完成后，调用`flip`切换为读模式，`limit`设置为`position`， `position`设置为0

      +----------------------------------------------+----------------------+
      |                 readable bytes               |                      |
      |                    (content)                 |                      |
      +----------------------------------------------+----------------------+
      |                                              |                      |
    position                 <=                    limit        <=       capacity
      0                                                                   

4.从`ByteBuffer`中读取数据，`position`递增，但不超过`limit`

      +--------------------+-------------------------+----------------------+
      |  compactable bytes |     readable bytes      |                      |
      |                    |        (content)        |                      |
      +--------------------+-------------------------+----------------------+
      |                                              |                      |
      0        <=       position       <=          limit        <=       capacity

5.读取操作完成后，此时有两种情况可供选择，如果buffer中还留有未读数据，可以调用`compact`方法，将上述compactable bytes移除；如果已经没有未读数据，或不关心未读数据，可以调用`clear`方法。调用`clear`方法相比`compact`方法代价更小，因为不涉及数组copy操作，只是更新position索引

* `clear`方法， 将`limit`设置为`capacity`，`position`设置为0

      +---------------------------------------------------------------------+
      |                             writable bytes                          |
      |                                                                     |
      +---------------------------------------------------------------------+
      |                                                                     |
      position                           <=                               limit
      0                                                                  capacity

* `compact`方法，将readable bytes copy到当前buffer中，`position`设置为readable bytes的length(remains)，`limit`设置为`capacity`

      +-----------------------+---------------------------------------------+
      |     readable bytes    |               writable bytes                |
      |        (content)      |                                             |
      +-----------------------+---------------------------------------------+
      |                       |                                             |
      0          <=        position                 <=                    limit
                                                                         capacity

可以继续向buffer中写入输入，`position`会递增，直到`limit`

#### ByteBuf

      +-------------------+------------------+------------------+
      | discardable bytes |  readable bytes  |  writable bytes  |
      |                   |     (CONTENT)    |                  |
      +-------------------+------------------+------------------+
      |                   |                  |                  |
      0      <=      readerIndex   <=   writerIndex    <=    capacity

---

1.新建一个初始状态的`ByteBuf`，`readerIndex`为0，`writerIndex`为`0`

      +---------------------------------------------------------+
      |                     writable bytes                      |
      |                                                         |
      +---------------------------------------------------------+
      |                                                         |
      readerIndex                                           capacity
      writerIndex
      0

2.向`ByteBuf`中写入数据后，`writerIndex`增加，但始终不超过`capacity`

<div class="bs-callout bs-callout-info">
	当写入数据超过可写入length时，<code>ByteBuf</code>检查是否达到<code>maxCapacity</code>，如果没有达到，则将buffer扩充相应的长度，<code>capacity</code>更新，直到等于<code>maxCapacity</code>
</div>

      +--------------------------------------+------------------+
      |             readable bytes           |  writable bytes  |
      |               (CONTENT)              |                  |
      +--------------------------------------+------------------+
      |                                      |                  |
	  readerIndex              <=           writerIndex    <=    capacity
      0

3.从`ByteBuf`中读取数据，`readerIndex`递增，但不能超过`writerIndex`

      +-------------------+------------------+------------------+
      | discardable bytes |  readable bytes  |  writable bytes  |
      |                   |     (CONTENT)    |                  |
      +-------------------+------------------+------------------+
      |                   |                  |                  |
      0      <=      readerIndex   <=   writerIndex    <=    capacity

4.不需要任何额外操作，用户可以自由对buffer进行读写，当然类似于`ByteBuffer`，你也可以执行`clear`和`compact`(在netty中为`discardReadBytes`方法)，`clear`方法直接更新`readerIndex`和`writerIndex`，`discardReadBytes`大多数情况下都会涉及到数组copy操作，不建议频繁使用。

* `clear`方法， 将`readerIndex`和`writerIndex`设置为0

      +---------------------------------------------------------+
      |                     writable bytes                      |
      |                                                         |
      +---------------------------------------------------------+
      |                                                         |
      readerIndex                                           capacity
      writerIndex
      0

* `discardReadBytes`方法，将readable bytes copy到buffer中，`readerIndex`设置为0，`writerIndex`设置为readable bytes的length

      +------------------+--------------------------------------+
      |  readable bytes  |             writable bytes           |
      |    (CONTENT)     |              (just growed)           |
      +------------------+--------------------------------------+
      |                  |                                      |
      readerIndex        writerIndex         <=             capacity
      0

### 切分复制ByteBuf

可以通过`duplicate()`, `slice()`, `slice(int, int)`, `readOnly()`, or `order(ByteOrder)`这些方法为已有的ByteBuf产生一个独立的view，这些views拥有独立的`readerIndex`和`writerIndex`以及markers，但是它们和现有的`ByteBuf`共享内部数据

`copy`方法会创建一个完全独立的`ByteBuf`实例，数据不共享

{% highlight java %}
Charset utf8 = Charset.forName(“UTF-8“);
ByteBuf buf = Unpooled.copiedBuffer(“Netty in Action rocks!“, utf8);
ByteBuf sliced = buf.slice(0, 14);
System.out.println(sliced.toString(utf8);
buf.setByte(0, (byte) ’J’);
assert buf.get(0) == sliced.get(0); #1
{% endhighlight %}

<div class="bs-callout bs-callout-info">
	语句1处不会fail，因为<code>slice</code>方法产生的<code>ByteBuf</code>共享内部数据
</div>

---

{% highlight java %}
Charset utf8 = Charset.forName(“UTF-8“);
ByteBuf buf = Unpooled.copiedBuffer(“Netty in Action rocks!“, utf8);
ByteBuf copy = buf.copy(0, 14);
System.out.println(copy.toString(utf8);
buf.setByte(0, (byte) ’J’);
assert buf.get(0) != copy.get(0); #2
{% endhighlight %}

<div class="bs-callout bs-callout-info">
	语句2处不会fail，因为<code>copy</code>方法产生的<code>ByteBuf</code>产用的是一个独立的内部数据
</div>

## ChannelHandlers

<div class="bs-callout bs-callout-info">
	通过写一个<code>DefaultFileRegion</code>实例到<code>Channel</code>，<code>ChannelHandlerContext</code>或<code>ChannelPipeline</code>来使用netty的zero-memory-copy写文件功能；如果需要对文件加密或压缩（例如使用HTTPS等），使用<code>ChunkedFile</code>或<code>ChunkedNioFile</code>代替
</div>

## How it works together

### Nio TCP Server

#### 启动一个简单的Server

首先TCP Server需要ServerBootstrap来启动，下面是启动一个简单的Server例子

{% highlight java %}
public class EchoServer {
    private final int port;
    public EchoServer(int port) {
        this.port = port;
    }
    public void start() throws Exception {
        EventLoopGroup group = new NioEventLoopGroup();
        try {
            ServerBootstrap b = new ServerBootstrap(); // 1
            b.group(group)  // 2
             .channel(NioServerSocketChannel.class) // 2
             .localAddress(new InetSocketAddress(port))    // 2
             .childHandler(new ChannelInitializer<SocketChannel>() {  // 3
                @Override
                public void initChannel(SocketChannel ch) throws Exception {
                    ch.pipeline().addLast(new EchoServerHandler());                  // 4
                }
             });
            ChannelFuture f = b.bind().sync(); // 5
            System.out.println(EchoServer.class.getName() +
                        “ started and listen on “ + f.channel().localAddress());
            f.channel().closeFuture().sync(); // 6
        } finally {
            group.shutdownGracefully().sync(); // 7
        }
    }
}
{% endhighlight %}

1. 要启动一个Server，需要new一个`ServerBootstrap`实例
2. 为Channel设置类型，这里使用`NioServerSocketChannel`，以及执行该Channel中IO以及其他事件的`EventLoopGroup`，需要绑定的本地端口
3. 当一个连接被接受，则创建一个子Channel，对应于该Channel的handlers为childHandler，一般在server中我们都只使用child handler，类似于bind的事件，属于父handler负责
4. 为child Channel的pipeline添加handlers
5. 服务bind到指定端口，并且block当前线程，直到bind操作完成
6. block当前线程，直到Server Channel关闭
7. 在Server Channel关闭后，将`EventLoopGroup`关闭

#### ServerBootstrap

`ServerBootstrap`是一个负责启动Server的辅助类，继承自`AbstractBootstrap`，其中包含了大量的设置方法，这些设置方法均返回this实例
在`ServerBootstrap`做完必要的设置后，就可以调用它的`bind`方法来绑定指定的端口，该方法在`AbstractBootstrap`

{% highlight java %}
public ChannelFuture bind(SocketAddress localAddress) {
    validate();       // 1
    if (localAddress == null) {
        throw new NullPointerException("localAddress");
    }
    return doBind(localAddress);  // 2
}
{% endhighlight %}

1. 调用validate方法，检查`ServerBootstrap`的设置，主要检测`group`，`childGroup`，`childHandler`，`channelFactory`是否为空
2. 调用内部方法doBind

{% highlight java %}
private ChannelFuture doBind(final SocketAddress localAddress) {
    final ChannelFuture regFuture = initAndRegister();  // 1
    final Channel channel = regFuture.channel();
    if (regFuture.cause() != null) {     // 2
        return regFuture;
    }
    final ChannelPromise promise;
    if (regFuture.isDone()) {      // 3
        promise = channel.newPromise();
        doBind0(regFuture, channel, localAddress, promise);
    } else {                               // 3
        // Registration future is almost always fulfilled already, but just in case it's not.
        promise = new DefaultChannelPromise(channel, GlobalEventExecutor.INSTANCE);
        regFuture.addListener(new ChannelFutureListener() {
            @Override
            public void operationComplete(ChannelFuture future) throws Exception {
                doBind0(regFuture, channel, localAddress, promise);
            }
        });
    }
    return promise;
}
{% endhighlight %}

1. 创建一个Channel，并初始化，注册，对于NIO来说，注册过程就是将当前Channel在selector中注册
2. 如果上述步骤中有异常发生，则直接返回
3. 如果上述步骤已完成，则bind指定端口，如果未完成，则设置回调，当完成上述步骤后，进行bind

创建Channel的代码如下

{% highlight java %}
@Override
public T newChannel(EventLoop eventLoop, EventLoopGroup childGroup) {
    try {
        Constructor<? extends T> constructor = clazz.getConstructor(EventLoop.class, EventLoopGroup.class);
        return constructor.newInstance(eventLoop, childGroup);
    } catch (Throwable t) {
        throw new ChannelException("Unable to create Channel from class " + clazz, t);
    }
}
{% endhighlight %}

如果设定`NioServerSocketChannel`为Channel，则上面代码中的`clazz`为`NioServerSocketChannel`

下面是init过程

{% highlight java %}
@Override
void init(Channel channel) throws Exception {
    final Map<ChannelOption<?>, Object> options = options();
    synchronized (options) {
        channel.config().setOptions(options);  // 为channel设置options
    }
    final Map<AttributeKey<?>, Object> attrs = attrs();
    synchronized (attrs) {   // 为channel设置attributes
        for (Entry<AttributeKey<?>, Object> e: attrs.entrySet()) {
            @SuppressWarnings("unchecked")
            AttributeKey<Object> key = (AttributeKey<Object>) e.getKey();
            channel.attr(key).set(e.getValue());
        }
    }
    ChannelPipeline p = channel.pipeline();
    if (handler() != null) {
        p.addLast(handler());  // 为Server设置handler
    }
    final ChannelHandler currentChildHandler = childHandler;
    final Entry<ChannelOption<?>, Object>[] currentChildOptions;
    final Entry<AttributeKey<?>, Object>[] currentChildAttrs;
    synchronized (childOptions) {
        currentChildOptions = childOptions.entrySet().toArray(newOptionArray(childOptions.size()));
    }
    synchronized (childAttrs) {
        currentChildAttrs = childAttrs.entrySet().toArray(newAttrArray(childAttrs.size()));
    }
    p.addLast(new ChannelInitializer<Channel>() {
        @Override
        public void initChannel(Channel ch) throws Exception {
            ch.pipeline().addLast(new ServerBootstrapAcceptor(currentChildHandler, currentChildOptions,
                    currentChildAttrs));  // 将这些属性设置在ServerBootstrapAcceptor，当有新的连接时，将这些属性设置到这些连接对应的channel中
        }
    });
}
{% endhighlight %}

register过程如下

{% highlight java %}
@Override
public final void register(final ChannelPromise promise) {
    if (eventLoop.inEventLoop()) {
        register0(promise);   // 如果当前线程为eventLoop线程，则执行register0
    } else {
        try {
            eventLoop.execute(new OneTimeTask() {   // 如果当前线程不是eventLoop线程，则使用eventLoop执行register0
                @Override
                public void run() {
                    register0(promise);
                }
            });
        } catch (Throwable t) {
            ...
        }
    }
}
{% endhighlight %}

在register0中会利用java nio的channel注册到selector中，ops为0

{% highlight java %}
selectionKey = javaChannel().register(eventLoop().selector, 0, this);  // attachment为Channel自身
{% endhighlight %}

除了上述操作外还会调用pipeline的`fireChannelRegistered`方法

下面再来看一下`doBind0`方法，它是真正负责将socket channel bind到指定端口的方法

{% highlight java %}
private static void doBind0(
        final ChannelFuture regFuture, final Channel channel,
        final SocketAddress localAddress, final ChannelPromise promise) {
    // This method is invoked before channelRegistered() is triggered.  Give user handlers a chance to set up
    // the pipeline in its channelRegistered() implementation.
    // ? 未找到该处是如何做到的
    channel.eventLoop().execute(new Runnable() {
        @Override
        public void run() {
            if (regFuture.isSuccess()) {
                channel.bind(localAddress, promise).addListener(ChannelFutureListener.CLOSE_ON_FAILURE);
            } else {
                promise.setFailure(regFuture.cause());
            }
        }
    });
}
{% endhighlight %}

`channel.bind`方法最终会调用`HeadHandler.bind`方法(该handler在创建`DefaultChannelPipeline`时，被添加到pipeline的开始位置，并且永远都处于开始位置)
`HeadHandler.bind`方法内容如下

{% highlight java %}
unsafe.bind(localAddress, promise);
{% endhighlight %}

`unsafe.bind`方法最终会调用`AbstractChannel.doBind`方法，该方法为抽象方法，而`NioServerSocketChannel`为它提供了实现

{% highlight java %}
javaChannel().socket().bind(localAddress, config.getBacklog());
{% endhighlight %}

<div class="bs-callout bs-callout-warning">
	目前还是没有弄清楚如何能够让bind在<code>fireChannelRegistered</code>之前被调用
</div>