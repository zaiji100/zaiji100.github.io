---
layout: post
title: "Solr Related"
category: Lucene
tags: [solr, range query, solrcloud, zookeeper]
---

## 范围查询 {#range-query}

使用{!frange l=0 u=80 incl=false incu=false}myField来进行范围查询
l和u必须为数字
incl为是否包含lower位
incu为是否包含upper位
myField是被查询的field
如果需要添加统计排除标识{!ex=dt}，使用以下写法
{!frange l=0 u=80 incl=false incu=false ex=dt}myField

## SolrCloud from release 4.4

Solr是一个基于J2EE的项目，所以首先查看WEB-INF/web.xml文件，可以看到solr注册了一个名为SolrRequestFilter的Filter，它指向了SolrDispatchFilter

### SolrCloud相关代码分析

`web.xml`

{% highlight xml %}
<!-- Any path (name) registered in solrconfig.xml will be sent to that filter -->
  <filter>
    <filter-name>SolrRequestFilter</filter-name>
    <filter-class>org.apache.solr.servlet.SolrDispatchFilter</filter-class>
  </filter>
  <filter-mapping>
    <filter-name>SolrRequestFilter</filter-name>
    <url-pattern>/*</url-pattern>
  </filter-mapping>
{% endhighlight %}

在J2EE容器启动时，会调用`SolrRequestFilter`的`init`方法，该方法会帮助solr创建一个`CoreContainer`实例，并调用它的`load`方法

{% highlight java %}
@Override
public void init(FilterConfig config) throws ServletException {
    log.info("SolrDispatchFilter.init()");
    try {
      // web.xml configuration
      this.pathPrefix = config.getInitParameter( "path-prefix" );
      this.cores = createCoreContainer();                    // 创建Cores Container
      log.info("user.dir=" + System.getProperty("user.dir"));
    }
    catch( Throwable t ) {
      // catch this so our filter still works
      log.error( "Could not start Solr. Check solr/home property and the logs");
      SolrCore.log( t );
    }
    log.info("SolrDispatchFilter.init() done");
}
 
// ...
 
protected CoreContainer createCoreContainer() {
    CoreContainer cores = new CoreContainer();
    cores.load();
    return cores;
}
{% endhighlight %}

再看`CoreContainer`的`load`方法

{% highlight java %}
public void load()  {
    // ...
    zkHost = cfg.get(ConfigSolr.CfgProp.SOLR_ZKHOST, null);    // zookeeper service的host（含端口）
    zkClientTimeout = cfg.getInt(ConfigSolr.CfgProp.SOLR_ZKCLIENTTIMEOUT, DEFAULT_ZK_CLIENT_TIMEOUT);  // 连接zookeeper service 的超时设置
    distribUpdateConnTimeout = cfg.getInt(ConfigSolr.CfgProp.SOLR_DISTRIBUPDATECONNTIMEOUT, 0);
    distribUpdateSoTimeout = cfg.getInt(ConfigSolr.CfgProp.SOLR_DISTRIBUPDATESOTIMEOUT, 0);
    // Note: initZooKeeper will apply hardcoded default if cloud mode
    String hostPort = cfg.get(ConfigSolr.CfgProp.SOLR_HOSTPORT, null);
    // Note: initZooKeeper will apply hardcoded default if cloud mode
    String hostContext = cfg.get(ConfigSolr.CfgProp.SOLR_HOSTCONTEXT, null);
    String host = cfg.get(ConfigSolr.CfgProp.SOLR_HOST, null);
    String leaderVoteWait = cfg.get(ConfigSolr.CfgProp.SOLR_LEADERVOTEWAIT, LEADER_VOTE_WAIT);
    zkClientTimeout = Integer.parseInt(System.getProperty("zkClientTimeout",
                                            Integer.toString(zkClientTimeout)));
    // 以上是从solr.xml中获取的一些zookeeper相关的配置信息
     
    zkSys.initZooKeeper(this, solrHome, zkHost, zkClientTimeout, hostPort,
                                hostContext, host, leaderVoteWait, genericCoreNodeNames,
                                distribUpdateConnTimeout, distribUpdateSoTimeout);
     
    if (isZooKeeperAware() && coreLoadThreads <= 1) {
      throw new SolrException(ErrorCode.SERVER_ERROR,
          "SolrCloud requires a value of at least 2 in solr.xml for coreLoadThreads");
    }
     
    // 下列代码省略，在后续分析
 }
{% endhighlight %}

其中`zkSys.initZooKeeper`帮助solr初始化了zookeeper

{% highlight java linenos %}
public void initZooKeeper(final CoreContainer cc, String solrHome, String zkHost, int zkClientTimeout,
                             String hostPort, String hostContext, String host, String leaderVoteWait,
                                boolean genericCoreNodeNames, int distribUpdateConnTimeout, int distribUpdateSoTimeout) {
    ZkController zkController = null;
     
    // if zkHost sys property is not set, we are not using ZooKeeper
    String zookeeperHost;
    if(zkHost == null) {
      zookeeperHost = System.getProperty("zkHost");
    } else {
      zookeeperHost = zkHost;
    }
 
 
    String zkRun = System.getProperty("zkRun");  // 是否运行zookeeper服务
     
    this.zkClientTimeout = zkClientTimeout;
    this.hostPort = hostPort;
    this.hostContext = hostContext;
    this.host = host;
    this.leaderVoteWait = leaderVoteWait;
    this.genericCoreNodeNames = genericCoreNodeNames;
    this.distribUpdateConnTimeout = distribUpdateConnTimeout;
    this.distribUpdateSoTimeout = distribUpdateSoTimeout;
     
    if (zkRun == null && zookeeperHost == null)
        return;  // not in zk mode
    // BEGIN: SOLR-4622: deprecated hardcoded defaults for hostPort & hostContext
    if (null == hostPort) {
      log.warn("Solr 'hostPort' has not be explicitly configured, using hardcoded default of " + DEFAULT_HOST_PORT + ".  This default has been deprecated and will be removed in future versions of Solr, please configure this value explicitly");
      hostPort = DEFAULT_HOST_PORT;
    }
    if (null == hostContext) {
      log.warn("Solr 'hostContext' has not be explicitly configured, using hardcoded default of " + DEFAULT_HOST_CONTEXT + ".  This default has been deprecated and will be removed in future versions of Solr, please configure this value explicitly");
      hostContext = DEFAULT_HOST_CONTEXT;
    }
    // END: SOLR-4622
 
    // zookeeper in quorum mode currently causes a failure when trying to
    // register log4j mbeans.  See SOLR-2369
    // TODO: remove after updating to an slf4j based zookeeper
    System.setProperty("zookeeper.jmx.log4j.disable", "true");
 
    if (zkRun != null) {
      String zkDataHome = System.getProperty("zkServerDataDir", solrHome + "zoo_data");  //设置zookeeper数据文件路径
      String zkConfHome = System.getProperty("zkServerConfDir", solrHome);         // zookeeper配置
      zkServer = new SolrZkServer(zkRun, zookeeperHost, zkDataHome, zkConfHome, hostPort);
      zkServer.parseConfig();
      zkServer.start();  // 开启本地zookeeper service
       
      // set client from server config if not already set
      if (zookeeperHost == null) {
        zookeeperHost = zkServer.getClientString();
      }
    }
 
    int zkClientConnectTimeout = 15000;
 
    if (zookeeperHost != null) {
      // we are ZooKeeper enabled
      try {
        // If this is an ensemble, allow for a long connect time for other servers to come up
        if (zkRun != null && zkServer.getServers().size() > 1) {
          zkClientConnectTimeout = 24 * 60 * 60 * 1000;  // 1 day for embedded ensemble
          log.info("Zookeeper client=" + zookeeperHost + "  Waiting for a quorum.");
        } else {
          log.info("Zookeeper client=" + zookeeperHost);         
        }
        String confDir = System.getProperty("bootstrap_confdir");  // 获取solr配置文件目录
        boolean boostrapConf = Boolean.getBoolean("bootstrap_conf"); 
         
        if(!ZkController.checkChrootPath(zookeeperHost, (confDir!=null) || boostrapConf)) {
          throw new ZooKeeperException(SolrException.ErrorCode.SERVER_ERROR,
              "A chroot was specified in ZkHost but the znode doesn't exist. ");
        }
        zkController = new ZkController(cc, zookeeperHost, zkClientTimeout,
            zkClientConnectTimeout, host, hostPort, hostContext,
            leaderVoteWait, genericCoreNodeNames, distribUpdateConnTimeout, distribUpdateSoTimeout,
            new CurrentCoreDescriptorProvider() {
              @Override
              public List<CoreDescriptor> getCurrentDescriptors() {
                List<CoreDescriptor> descriptors = new ArrayList<CoreDescriptor>(
                    cc.getCoreNames().size());
                Collection<SolrCore> cores = cc.getCores();
                for (SolrCore core : cores) {
                  descriptors.add(core.getCoreDescriptor());
                }
                return descriptors;
              }
            });
 
        if (zkRun != null && zkServer.getServers().size() > 1 && confDir == null && boostrapConf == false) {
          // we are part of an ensemble and we are not uploading the config - pause to give the config time
          // to get up
          Thread.sleep(10000);
        }
         
        if(confDir != null) {
          File dir = new File(confDir);
          if(!dir.isDirectory()) {
            throw new IllegalArgumentException("bootstrap_confdir must be a directory of configuration files");
          }
          String confName = System.getProperty(ZkController.COLLECTION_PARAM_PREFIX+ZkController.CONFIGNAME_PROP,
                             "configuration1");
          zkController.uploadConfigDir(dir, confName);  // 指定配置文件存放目录，并将其上传到zookeeper
        }
         
        if(boostrapConf) {
          ZkController.bootstrapConf(zkController.getZkClient(), cc.cfg, solrHome);  // 找到solr home下的solr.xml, 遍历每个core，并将core下conf目录上传到zookeeper
        }
         
      } catch (InterruptedException e) {
        // Restore the interrupted status
        Thread.currentThread().interrupt();
        log.error("", e);
        throw new ZooKeeperException(SolrException.ErrorCode.SERVER_ERROR,
            "", e);
      } catch (TimeoutException e) {
        log.error("Could not connect to ZooKeeper", e);
        throw new ZooKeeperException(SolrException.ErrorCode.SERVER_ERROR,
            "", e);
      } catch (IOException e) {
        log.error("", e);
        throw new ZooKeeperException(SolrException.ErrorCode.SERVER_ERROR,
            "", e);
      } catch (KeeperException e) {
        log.error("", e);
        throw new ZooKeeperException(SolrException.ErrorCode.SERVER_ERROR,
            "", e);
      }
    }
    this.zkController = zkController;
  }
{% endhighlight %}

line49，创建了一个SolrZkServer的实例，并通过parseConfig方法获取zoo.cfg文件的配置，start方法新建一个线程，启动zookeeper service,下面看SolrZkServer的start方法

{% highlight java %}
public void start() {
    if (zkRun == null) return;
    zkThread = new Thread() {
      @Override
      public void run() {
        try {
          if (zkProps.getServers().size() > 1) {
            QuorumPeerMain zkServer = new QuorumPeerMain();       // 如果zookeeper server数为多个，使用QuorumPeerMain类开启zookeeper集群模式
            zkServer.runFromConfig(zkProps);
          } else {
            ServerConfig sc = new ServerConfig();
            sc.readFrom(zkProps);
            ZooKeeperServerMain zkServer = new ZooKeeperServerMain();  // 如果zookeeper server数为一个，使用ZooKeeperServerMain类开启单机模式
            zkServer.runFromConfig(sc);
          }
          log.info("ZooKeeper Server exited.");
        } catch (Throwable e) {
          log.error("ZooKeeper Server ERROR", e);
          throw new SolrException(SolrException.ErrorCode.SERVER_ERROR, e);
        }
      }
    };
 
    if (zkProps.getServers().size() > 1) {
      log.info("STARTING EMBEDDED ENSEMBLE ZOOKEEPER SERVER at port " + zkProps.getClientPortAddress().getPort());
    } else {
      log.info("STARTING EMBEDDED STANDALONE ZOOKEEPER SERVER at port " + zkProps.getClientPortAddress().getPort());
    }
 
    zkThread.setDaemon(true);
    zkThread.start();
    try {
      Thread.sleep(500); // pause for ZooKeeper to start
    } catch (Exception e) {
      log.error("STARTING ZOOKEEPER", e);
    }
  }
{% endhighlight %}

至此，zookeeper服务初始化完毕.

### SolrCloud中相关配置：

<table class="table">
  <thead><tr><th>配置名</th><th>默认值</th><th>描述</th><th>是否采用</th></tr></thead>
  <tbody>
  	<tr>
  		<td>numShards</td><td>Defaults to 1</td><td>The number of shards to hash documents to. There will be one leader per shard and each leader can have N replicas.</td><td></td>
  	</tr>
  	<tr class="info">
  		<td colspan="4"><strong>SolrCloud Instance Params</strong></td>
  	</tr>
	<tr>
  		<td>host</td><td>Defaults to the first local host address found </td><td>If the wrong host address is found automatically, you can over ride the host address with this param. </td><td>System</td>
  	</tr>
  	<tr>
  		<td>hostPort</td><td>Defaults to the jetty.port system property</td><td>The port that Solr is running on - by default this is found by looking at the jetty.port system property. </td><td>System</td>
  	</tr>
  	<tr>
  		<td>hostContext</td><td>Defaults to solr </td><td>The context path for the Solr webapp. (Note: in Solr 4.0, it was mandatory that the hostContext not contain "/" or "_" characters. Begining with Solr 4.1, this limitation was removed, and it is recomended that you specify the begining slash. When running in the example jetty configs, the "hostContext" system property can be used to control both the servlet context used by jetty, and the hostContext used by SolrCloud -- eg: -DhostContext=/solr)</td><td></td>
  	</tr>
  	<tr class="info">
  		<td colspan="4"><strong>SolrCloud Zookeeper Instance Params</strong></td>
  	</tr>
  	<tr>
  		<td>zkRun</td><td>Defaults to localhost:&lt;solrPort+1001&gt;</td><td>Causes Solr to run an embedded version of ZooKeeper. Set to the address of ZooKeeper on this node - this allows us to know who 'we are' in the list of addresses in the zkHost connect string. Simply using -DzkRun gets you the default value. Note this must be one of the exact strings from zkHost; in particular, the default localhost will not work for a multi-machine ensemble. </td><td>System</td>
  	</tr>
  	<tr>
  		<td>zkHost</td><td>No default </td><td>The host address for ZooKeeper - usually this should be a comma separated list of addresses to each node in your ZooKeeper ensemble.</td><td>System+File</td>
  	</tr>
  	<tr>
  		<td>zkClientTimeout</td><td>Defaults to 15000</td><td>The time a client is allowed to not talk to ZooKeeper before having it's session expired.</td><td>System+File</td>
  	</tr>
  	<tr class="info">
  		<td colspan="4"><strong>SolrCloud Core Params</strong></td>
  	</tr>
  	<tr>
  		<td>shard</td><td>The shard id. Defaults to being automatically assigned based on numShards </td><td>Allows you to specify the id used to group SolrCores into shards.</td><td></td>
  	</tr>
	<tr class="info">
  		<td colspan="4"><strong>Config Startup Bootstrap Params</strong></td>
  	</tr>
  	<tr>
  		<td>bootstrap_conf</td><td>No default </td><td>If you pass -Dbootstrap_conf=true on startup, each SolrCore you have configured will have it's configuration files automatically uploaded and linked to the collection that SolrCore is part of </td><td></td>
  	</tr>
  	<tr>
  		<td>bootstrap_confdir</td><td>No default </td><td>If you pass -bootstrap_confdir=&lt;directory&gt; on startup, that specific directory of configuration files will be uploaded to ZooKeeper with a 'conf set' name defined by the below system property, collection.configName</td><td>System</td>
  	</tr>
  	<tr>
  		<td>collection.configName</td><td>Defaults to configuration1 </td><td>Determines the name of the conf set pointed to by bootstrap_confdir  </td><td></td>
  	</tr>
  </tbody>
</table>