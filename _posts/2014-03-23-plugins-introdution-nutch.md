---
layout: post
title: "Plugins Introdution - Nutch"
category: Nutch
tags: [nutch, plugin]
---
在Nutch中，大量的可扩展的部分都使用了插件来做，如网页下载时所用的协议选择，解析不同类型的网页，url的过滤和规范化都使用了Nutch的插件机制。

Nutch中插件的主要目标是：

* 可扩展性：用户可以通过实现相应的接口来生成自己的扩展插件
* 灵活性：任务人都可以参与插件的编写。
* 可维护性：插件的开发者只要实现相应的扩展接口，而不需要关注插件的内部原理。

## 1. 一些概念 {#some-concepts}

### 1.1 插件仓库(PluginRepository)

插件仓库是一个所有插件的注册器，在系统启动时，这个仓库是通过分析插件目录中所有插件的mainfest文件来生成。对于每一个插件都会生成一个插件描述实例，它包含了每一个插件的元数据，所以插件的真正的实例会在用的时候再来创建，也就是所谓的延迟插件载入机制(lazy plugin loading)。 

### 1.2 插件(Plugin)

Nutch中的插件实际上是一系列自定义逻辑的容器，而这些自定义逻辑为Nutch的核心功能提供扩展和为其它插件提供扩展API。一个插件要提供一个或者一组扩展。而对于扩展点来说(ExtensionPoints)来说，这些扩展都可以被看做是一组可以被动态加载的监听器。每一个具体的插件都扩展自基类Plugin，而这些实例又被用于去管理相关功能的生命周期。插件打开与关闭都由Nutch的插件管理系统来操作。

### 1.3 扩展(Extension)

扩展相当于一种被安装在具体的扩展点(ExtensionPoint)上的监听描述符，这里的扩展点扮演了一个发布者的角色。

### 1.4 扩展点(ExtensionPoint)

扩展点提供了一类具体功能扩展的元信息，它包含了具体的扩展

### 1.5 插件描述符(PluginDescriptor)

插件描述符提供了一种对于Nutch所插件元数据的一种描述，它包含了国际化资源和插件本自的classloader。而这些元数据包含了插件(Plugin)、插件扩展点(ExtensionPoint)和扩展(Extension).而这里为了能够通过插件描述符来管理元数据，提供了一种延迟加载机制。

## 2. 使用bin/nutch运行插件 {#run-the-plugin}

本机运行出现的帮助

{% highlight bash %}
$ bin/nutch plugin
    Usage: PluginRepository pluginId className [arg1 arg2 ...]
{% endhighlight %}

这里主要有三个参数：

* pluginId:这个是插件的id号，它是每一个插件目录中的plugin.xml文件里里面plugin标签中的id属性
* className:这是扩展插件的类全
* args:这是插件main函数的参数

一个简单的调用protocoal的Http协议的命令

{% highlight bash %}
$ bin/nutch plugin protocol-http org.apache.nutch.protocol.http.Http -verbose -timeout 10 http://www.baidu.com
{% endhighlight %}

* pluginId: protocol-http
* className: org.apache.nutch.protocol.http.Http
* args: -verbos -timeout 10 [http://www.baidu.com]

这里的输出就是baidu的网页源代码。下面简单分析一下其调用的源代码。

## 3. 源代码分析 {#source}

这是`PluginRepository.java`中的`main`函数，上面的`bin/nutch plugin`命令就是调用这个函数的

{% highlight java %}
public static void main(String[] args) throws Exception {
    if (args.length < 2) {
        System.err.println("Usage: PluginRepository pluginId className [arg1 arg2 ...]");
        return;
    }
    // 生成Nutch的配置
    // 这里主要使用的参数是plugin的目录名，还有plugin.includes包含哪些要读取的plugin
    Configuration conf = NutchConfiguration.create();
    // 根据配置生成一个插件仓库,并且对其进行初始化
    PluginRepository repo = new PluginRepository(conf);
    // args[0] - plugin ID
    // 根据插件ID得到特定的插件描述符
    PluginDescriptor d = repo.getPluginDescriptor(args[0]);
    if (d == null) {
        System.err.println("Plugin '" + args[0] + "' not present or inactive.");
        return;
    }
    // 从插件描述符对象中得到类加载器
    ClassLoader cl = d.getClassLoader();
    // args[1] - class name
    Class clazz = null;
    try {
        // 加载对应的类
        clazz = Class.forName(args[1], true, cl);
    } catch (Exception e) {
        System.err.println("Could not load the class '" + args[1] + ": " + e.getMessage());
        return;
    }
    Method m = null;
    try {
        // 得到特定的main方法
        m = clazz.getMethod("main", new Class[] { args.getClass() });
    } catch (Exception e) {
        System.err.println("Could not find the 'main(String[])' method in class " + args[1] + ": " + e.getMessage());
        return;
    }
    String[] subargs = new String[args.length - 2];
    System.arraycopy(args, 2, subargs, 0, subargs.length);
// 这里是运行插件的main方法
    m.invoke(null, new Object[] { subargs });
}
{% endhighlight %}

## 4. 插件机制分析 {#plugin-mechanism}

### 4.1. 一些对象说明 

* PluginRepository:这是一个用于存储所有插件描述对象(PluginDescriptor)，插件扩展点(ExtensionPoint)和被激活的插件。
* PluginDescriptor:用于描述单个扩展插件的元信息，它的内容主要是从plugin.xml中得到。
* Plugin: 用于描述插件的一个抽象，其中包括了一个插件描述符，它们是一对一的关系。
* ExtensionPoint: 这个扩展点主要是一个面象对象中的接口的意思，就是说可以有多个扩展来实现这个接口，一个或者多个扩展点实际上就是一个插件，如nutch-extensionpoints.
* Extension: 扩展是对于扩展点的实现，一个插件可以包含多个扩展。
* PluginManifestParser: 主要是用于解析插件目录下的plugin.xml文件，生成相应的PluginDescriptor对象。
* PluginClassLoader: 它继承自URLClassLoader，用来根据urls动态生成相应的插件实现对象

### 4.2. 插件仓库初始化流程

`PluginRepository`的生成有两种方法，一个是直接new一个相应的对象，另一个是调用`PluginRepository`的静态的`get`方法，从Cache中得到相应的`PluginRepository`，在Nutch的流程中，一般是通用使用第二种方法来得到`PluginRepository`，这样可以保证资源在多个流程中得到共享。

#### 4.2.1 PluginRepostory的初始化在其ctr函数中进行

源代码如下

{% highlight java %}
fActivatedPlugins = new HashMap<String, Plugin>();
fExtensionPoints = new HashMap<String, ExtensionPoint>();
this.conf = conf;
// 当被配置为过滤（即不加载），但是又被其他插件依赖的时候，是否自动启动，缺省为 true
this.auto = conf.getBoolean("plugin.auto-activation", true);
// 插件的目录名，可以是多个目录
String[] pluginFolders = conf.getStrings("plugin.folders");
PluginManifestParser manifestParser = new PluginManifestParser(conf, this);
Map<String, PluginDescriptor> allPlugins = manifestParser.parsePluginFolder(pluginFolders);
// 要排除的插件名称列表，支持正则表达式方式定义
Pattern excludes = Pattern.compile(conf.get("plugin.excludes", ""));
// 要包含的插件名称列表，支持正则表达式方式定义
Pattern includes = Pattern.compile(conf.get("plugin.includes", ""));
// 对不使用的插件进行过滤，返回过滤后的插件
Map<String, PluginDescriptor> filteredPlugins = filter(excludes, includes,allPlugins);
// 对插件的依赖关系进行检查
fRegisteredPlugins = getDependencyCheckedPlugins(filteredPlugins,this.auto ? allPlugins : filteredPlugins);
// 安装扩展点，主要是针对nutch-extensionpoints这个插件的
installExtensionPoints(fRegisteredPlugins);
try {
    // 安装特定扩展点的相应扩展集
    // NOTE：其实这边的扩展点与扩展都是以插件的形式表现的
    installExtensions(fRegisteredPlugins);
} catch (PluginRuntimeException e) {
    LOG.fatal(e.toString());
    throw new RuntimeException(e.getMessage());
}
displayStatus();
{% endhighlight %}

#### 4.2.2 下面分析一个插件描述符的生成

插件描述符的生成主要是通用调用`PluginManifestParser`这个对象的`parsePluginFolder`这个方法生成的，源代码如下

{% highlight java %}
/**
 * Returns a list of all found plugin descriptors.
 * @param pluginFolders folders to search plugins from
 * @return A {@link Map} of all found {@link PluginDescriptor}s.
 */
public Map<String, PluginDescriptor> parsePluginFolder(String[] pluginFolders) {
    Map<String, PluginDescriptor> map = new HashMap<String, PluginDescriptor>();
    if (pluginFolders == null) {
        throw new IllegalArgumentException("plugin.folders is not defined");
    }
    for (String name : pluginFolders) {
        // 遍历所有插件目录,这里的getPluginFolder方法解析一个资源的相对路径的问题
        File directory = getPluginFolder(name);
        if (directory == null) {
            continue;       
        }       
        LOG.info("Plugins: looking in: " + directory.getAbsolutePath());
        // 遍历所有子插件目录中的插件
        for (File oneSubFolder : directory.listFiles()) {
            if (oneSubFolder.isDirectory()) {
                String manifestPath = oneSubFolder.getAbsolutePath() + File.separator + "plugin.xml";
                try {
                    LOG.debug("parsing: " + manifestPath);
                    // 分析plugin.xml文件
                    PluginDescriptor p = parseManifestFile(manifestPath);
                    map.put(p.getPluginId(), p);
                } catch (MalformedURLException e) {
                    LOG.warn(e.toString());
                } catch (SAXException e) {
                    LOG.warn(e.toString());
                } catch (IOException e) {
                    LOG.warn(e.toString());
                } catch (ParserConfigurationException e) {
                    LOG.warn(e.toString());
                }
            }
        }
    }
    return map;
}
 
private PluginDescriptor parseManifestFile(String pManifestPath) throws MalformedURLException, SAXException, IOException, ParserConfigurationException {
    // 解析xml文件，生成Document对象
    Document document = parseXML(new File(pManifestPath).toURL());
    String pPath = new File(pManifestPath).getParent();
    // 对xml进行分析
    return parsePlugin(document, pPath);
}
 
private PluginDescriptor parsePlugin(Document pDocument, String pPath) throws MalformedURLException {
    Element rootElement = pDocument.getDocumentElement();
    // 这里是解析xml中的如下信息
    // <plugin id="index-anchor" name="Anchor Indexing Filter" version="1.0.0" provider-name="nutch.org">
    String id = rootElement.getAttribute(ATTR_ID);
    String name = rootElement.getAttribute(ATTR_NAME);
    String version = rootElement.getAttribute("version");
    String providerName = rootElement.getAttribute("provider-name");
    // 插件类属性，不过这里好像没有用到过
    String pluginClazz = null;
    if (rootElement.getAttribute(ATTR_CLASS).trim().length() > 0) {
        pluginClazz = rootElement.getAttribute(ATTR_CLASS);
    }
    // 生成插件描述符对象
    PluginDescriptor pluginDescriptor = new PluginDescriptor(id, version, name, providerName, pluginClazz, pPath, this.conf);
    LOG.debug("plugin: id=" + id + " name=" + name + " version=" + version + " provider=" + providerName + "class=" + pluginClazz);
    // 这里是解析如下内容
    // <extension id="org.apache.nutch.indexer.anchor" name="Nutch Anchor Indexing Filter" point="org.apache.nutch.indexer.IndexingFilter">
    //     <implementation id="AnchorIndexingFilter" class="org.apache.nutch.indexer.anchor.AnchorIndexingFilter" />
    // </extension>
    parseExtension(rootElement, pluginDescriptor);
    // 这里主要是解析nutch-extensionPoints这个插件,xml内容如下
    // <extension-point id="org.apache.nutch.indexer.IndexingFilter" name="Nutch Indexing Filter"/>
    // <extension-point id="org.apache.nutch.parse.Parser" name="Nutch Content Parser"/>
    // <extension-point id="org.apache.nutch.parse.HtmlParseFilter" name="HTML Parse Filter"/>
    parseExtensionPoints(rootElement, pluginDescriptor);
    // 这里主要是解析插件的动态库与插件所使用的第三方库，xml内容如下
    // <runtime>
    //     <library name="parse-tika.jar">
    //         <export name="*"/>
    //     </library>
    //     <library name="apache-mime4j-0.6.jar"/>
    //     <library name="asm-3.1.jar"/>
    //     <library name="bcmail-jdk15-1.45.jar"/>
    //     <library name="bcprov-jdk15-1.45.jar"/>
    // </runtime>
    parseLibraries(rootElement, pluginDescriptor);
    // 这里解析插件依赖的插件库，xml内容如下
    // <requires>
    //     <import plugin="nutch-extensionpoints"/>
    //     <import plugin="lib-regex-filter"/>
    // </requires>
    parseRequires(rootElement, pluginDescriptor);
    return pluginDescriptor;
}
{% endhighlight %}

注意的是这个`PluginManifestParser`就是用来解析相应的`plugin.xml`文件，生成`PluginRepository`对象的，这个有一个很奇怪的概念就是一个插件描述符(`PluginDescriptor`)可以包含多个可扩展点或者可扩展点的实现，这里为什么不把可扩展点分离出来，`PluginDescriptor`就只包含一个或者多个可扩展点的实现。而可扩展点就是插件的接口定义

#### 4.2.3 插件依赖关系的检查

这个依赖关系的检查很有趣，主要是根据plugin.auto-activation这个参数来定的，部分源代码如下：

{% highlight java %}
/**
 * @param filtered is the list of plugin filtred
 * @param all is the list of all plugins found.
 * @return List
 */
private List<PluginDescriptor> getDependencyCheckedPlugins(Map<String, PluginDescriptor> filtered, Map<String, PluginDescriptor> all) {
    if (filtered == null) {
        return null;
    }
    Map<String, PluginDescriptor> checked = new HashMap<String, PluginDescriptor>();
   
   
    // 遍历所有过滤后的插件
    for (PluginDescriptor plugin : filtered.values()) {
        try {
            // 保存当前插件的依赖插件描述符
            checked.putAll(getPluginCheckedDependencies(plugin, all));
            // 保存当前插件描述符
            checked.put(plugin.getPluginId(), plugin);
        } catch (MissingDependencyException mde) {
            // Log exception and ignore plugin
            LOG.warn(mde.getMessage());
        } catch (CircularDependencyException cde) {
            // Simply ignore this plugin
            LOG.warn(cde.getMessage());
        }
    }
    return new ArrayList<PluginDescriptor>(checked.values());
}
{% endhighlight %}

## 5. 插件调用流程 {#process-of-plugin}

插件调用流程主要分成如下几步：

1. 根据扩展点ID号从插件仓库中得到相应的扩展点对象
2. 根据扩展点对象得到相应的扩展集
3. 遍历扩展集，从扩展对象中实例化出相应的扩展来，实例化的过滤就是调用PluginClassLoader

下面是生成URLFilter插件的部分代码

{% highlight java %}
// (1)
ExtensionPoint point = PluginRepository.get(conf).getExtensionPoint(URLFilter.X_POINT_ID);
if (point == null)
    throw new RuntimeException(URLFilter.X_POINT_ID + " not found.");
   
   
// (2)
Extension[] extensions = point.getExtensions();
Map<String, URLFilter> filterMap = new HashMap<String, URLFilter>();
for (int i = 0; i < extensions.length; i++) {
    Extension extension = extensions[i];
   
   
    // (3)
    URLFilter filter = (URLFilter) extension.getExtensionInstance();
    if (!filterMap.containsKey(filter.getClass().getName())) {
        filterMap.put(filter.getClass().getName(), filter);
    }
}
{% endhighlight %}

## 6. 总结  {#summary}

这里只是对Nutch的插件做一个简单的介绍，下面我们会来自己动手写一个相应的插件，最后我们会看一下其插件的实现原理。

## 7. 参考 {#reference}

<http://wiki.apache.org/nutch/PluginCentral?highlight=%28%28WhichTechnicalConceptsAreBehindTheNutchPluginSystem%29%29>