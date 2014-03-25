---
layout: post
title: "Hello Netty"
category: Netty
tags: [NIO, netty]
---
## 写一个NettyServer {#write-a-netty-server}

要编写一个Netty Server，需要两个主要步骤：

* `Bootstrapping`－配置Server监听端口，线程等
* 实现一个Server Handler，用来处理类似连接到达，接收消息等。

{% highlight java %}
public class NettyEchoServer {
    private static Logger log = LoggerFactory.getLogger(NettyEchoServer.class);
    public void serve(int port) throws InterruptedException {
        NioEventLoopGroup group = new NioEventLoopGroup();
        ServerBootstrap bootstrap = new ServerBootstrap();  // 1. 新建一个bootstrap用来配置Server并启动
        bootstrap.group(group)                              // 2. 设置NioEventLoopGroup处理新连接以及消息
                 .channel(NioServerSocketChannel.class)     // 2
                 .localAddress(new InetSocketAddress(port))  // 2. 指定Server绑定的端口来接受新连接
                 .childHandler(new ChannelInitializer<SocketChannel>() {     // 3. 设置一个ChannelHandler来处理一个新连接
                     @Override
                     protected void initChannel(SocketChannel sc) throws Exception {
                         sc.pipeline().addLast(new EchoServerHandler());   // 4
                     }
                 });
        try {
            ChannelFuture f = bootstrap.bind().sync();   // 5. 绑定端口并启动Server
            log.info(NettyEchoServer.class.getSimpleName() + " started and listened on " + f.channel().localAddress());
            f.channel().closeFuture().sync();         // 6. 阻塞当前线程，直到ServerChannel关闭
        } catch (InterruptedException e) {
            log.error("Error", e);
        } finally {
            group.shutdownGracefully().sync();     // 7
        }
    }
}
{% endhighlight %}

1. 为了启动Server，需要新建一个`ServerBootstrap`实例
2. 由于使用NIO transport，需要设置一个`NioEventLoopGroup`实例来接受和处理新连接，设置channel类型为`NioServerSocketChannel`，另外需要设置绑定的端口来接受新连接
3. 设置一个`ChannelHandler`来处理新连接，这里需要使用`ChannelInitializer`
4. `ChannelPipeLine`存放着一个channel的`ChannelHandler`
5. 调用`ServerBootstrap.bind`绑定端口，启动Server；调用`sync`阻塞当前线程，知道Server完成绑定
6. 程序阻塞，直到server channel关闭
7. 当应用退出时，关闭`EventGroupLoop`，释放所有资源，包括所有创建的线程

{% highlight java %}
@ChannelHandler.Sharable           // 在handler在channels间共享
public class EchoServerHandler extends ChannelInboundHandlerAdapter {
    private Logger log = LoggerFactory.getLogger(EchoServerHandler.class);
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        log.info("Server Read:" + msg);
        ctx.write(msg);     // 将接收到的消息发送回给客户端，这里并没有flush
    }
    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) throws Exception {
        // flush所有前面（pending）的消息，在所有操作完成后，关闭远程channel
        ctx.writeAndFlush(Unpooled.EMPTY_BUFFER).addListener(ChannelFutureListener.CLOSE);
    }
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        log.error("Server Error:", cause);
        ctx.close();    // 发生异常后，关闭远程channel
    }
}
{% endhighlight %}

## 写一个Netty客户端 {#write-a-netty-client}

要编写一个netty客户端，需要以下步骤：

* 连接到Server端
* 发送一个消息到Server 端
* 等待并接收来自Server端的回复
* 关闭连接

{% highlight java %}
public class NettyEchoClient {
    private final String host;
    private final int port;
    public NettyEchoClient(String host, int port) {
        this.host = host;
        this.port = port;
    }
    public void start() throws InterruptedException {
        NioEventLoopGroup group = new NioEventLoopGroup();
        Bootstrap bootstrap = new Bootstrap();    // 为client创建一个Bootstrap实例
        bootstrap.group(group)    // 由于使用NIO transport，所以使用NioEventLoopGroup
                 .channel(NioSocketChannel.class)  // 指定channel类型为NIO transport
                 .remoteAddress(new InetSocketAddress(host, port))  // 指定客户端连接到的服务端地址
                 .handler(new ChannelInitializer<SocketChannel>() {  // 使用ChannelInitializer指定ChannelHandler
                     @Override
                     protected void initChannel(SocketChannel ch) throws Exception {
                         ch.pipeline().addLast(new EchoClientHandler());
                     }
                 });
        try {
            ChannelFuture future = bootstrap.connect().sync();  // 启动客户端，连接到server; 调用sync方法阻塞线程直到成功连接到server
            future.channel().closeFuture().sync();   // 阻塞当前线程直到客户端连接关闭
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            group.shutdownGracefully().sync(); // 释放所有资源，以及所有创建的线程
        }
    }
}
{% endhighlight %}

使用`SimpleChannelInboundHandler`来实现客户端逻辑

{% highlight java %}
@ChannelHandler.Sharable
public class EchoClientHandler extends SimpleChannelInboundHandler<ByteBuf> {
    private static Logger log = LoggerFactory.getLogger(EchoClientHandler.class);
    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        // 当该客户端连接建立并连接到server后，发送消息到Server
        ctx.writeAndFlush(Unpooled.copiedBuffer("Hello, Netty", CharsetUtil.UTF_8));
    }
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        cause.printStackTrace();  
        ctx.close();   // 当异常发生时，打印堆栈信息并关闭连接
    }
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, ByteBuf msg) throws Exception {
        // 接收并打印来自服务端的消息
        log.info("Client Read: {}", ByteBufUtil.hexDump(msg.readBytes(msg.readableBytes())));
    }
}
{% endhighlight %}

<div class="bs-callout bs-callout-info">
	<p>这里用到SimpleChannelInboundHandler，而不是和服务端ChannelInboundHandlerAdapter，主要原因是由于当你使用ChannelInboundHandlerAdapter处理完接收到的消息后，你需要释放资源，例如本例中，需要调用ByteBuf.release()，而如果使用SimpleChannelInboundHandler时，当执行完channelRead0方法后，netty会负责资源的释放，当然这需要netty处理的消息都实现了ReferenceCounted接口。</p>
	<p>而在Server端未使用SimpleChannelInboundHandler的原因是我们希望Server端能够将接收到的消息写回给clients，也就是说，由于写操作可能在channelRead返回后完成（写操作是异步的），所以我们不能在channelRead中释放资源，当写操作完成后，netty会自动释放消息。</p>
</div>