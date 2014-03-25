---
layout: post
title: "ParseSegment - Nutch"
category: Nutch
tags: [hadoop, nutch, parse, map-reduce]
---
## 1. bin/nutch parse

这个命令主要是用来解析抓取的内容，对其进行外链接分析，计算分数等操作，这个解析在抓取的时候就可以设置是否进行，如果在抓取的时候没有设置解析抓取的网页内容，那这边可以单独用一个Map-Reduce任务来做。

后面的参数为：`Usage: ParseSegment segment`, 这里是一个segment的目录名

## 2. ParseSegment源代码分析 {#the-source-of-parsesegment}

### 2.1 任务的启动

`ParseSegment`任务的启动也是用一个Map-Reduce任务的，下面是它的源代码

{% highlight java %}
// 配置一个Job JobConf job = new NutchJob(getConf());
job.setJobName("parse " + segment);
// add content directory to FileInputFormat path            // 把segment目录下的content目录加入输入路径中
FileInputFormat.addInputPath(job, new Path(segment, Content.DIR_NAME));
job.set(Nutch.SEGMENT_NAME_KEY, segment.getName());
// set input format                                         // 设置输入格式
job.setInputFormat(SequenceFileInputFormat.class);          // 设置Map-Reduce方法
job.setMapperClass(ParseSegment.class);
job.setReducerClass(ParseSegment.class);
// 设置输出路径
FileOutputFormat.setOutputPath(job, segment);
// Parse Output Format to output                             // 设置输出格式
job.setOutputFormat(ParseOutputFormat.class);                // 设置输出的<key,value>类型<Text,ParseImpl>
job.setOutputKeyClass(Text.class);
// NOTE：这里注意一下，输出的value为ParseImpl，而ParseOutputFormat的输出为Parse，
// 这里的ParseImpl是实现Parse接口的，是is-a的关系
job.setOutputValueClass(ParseImpl.class);
JobClient.runJob(job);
{% endhighlight %}

### 2.2 ParseSegment类中的Map与Reduce分析

这个类主要是用来分析content中的内容，它实现了`Mapper`与`Reducer`接口

在Mapper中，主要是对content内容进行调用相应的插件进行解析，产生一个`ParseResult`，再遍历这个`ParseResult`,把其中解析出来的内容collect出去。这个`ParseResult`是一个收集解析结果的容器，其元素为`<Text,Parse>`对，这里解析可能产生多个这样的输出元素对，因为这里可能有多个内容与原url进行关联，所以就有可能产生多个`<Text,Parse>`输出
这里的Reduce很有趣，只是收集第一个`<Text,Parse>`对，还不知道是为什么，可能是因为它认为第一个`<Text,Parse>`的权重最大吧

### 2.3 ParseOutputFormat的分析

我们知道，在写关于Map-Reduce的时候，有时我们想自己控制输出的源，这里你就要实现其架构提供的`OutputFormat`，前提是你没有找到合适的输出方法，因为Hadoop框架提出了几个常用的`OutputFormat`方法。
在实现的`OutputFormat`接口，主要是实现一个叫`getRecordWriter`，这个方法返回一个自定义的`RecordWriter`的子类，用用于写出Reducer的输出&lt;key,value&gt;对，注意一下，在Hadoop架构中，一个&lt;key,value&gt;也叫一条记录。
下面我们来分析一下这个getReocrdWriter方法，源代码如下：

{% highlight java %}
public RecordWriter<Text, Parse> getRecordWriter(FileSystem fs, JobConf job, String name, Progressable progress) throws IOException { // 这里根据配置生成一个url过滤器
    this.filters = new URLFilters(job);                                               // 这里生成一个url的规格化对象
    this.normalizers = new URLNormalizers(job, URLNormalizers.SCOPE_OUTLINK);         // 这里生成一个分数计算器
    this.scfilters = new ScoringFilters(job);                                         // 配置url的抓取间隔
    final int interval = job.getInt("db.fetch.interval.default", 2592000);            // 得到是否要解析外链接
    final boolean ignoreExternalLinks = job.getBoolean("db.ignore.external.links", false); // 得到每一个网页外链接的解析个数,默认是100个，
    int maxOutlinksPerPage = job.getInt("db.max.outlinks.per.page", 100);
    final int maxOutlinks = (maxOutlinksPerPage < 0) ? Integer.MAX_VALUE : maxOutlinksPerPage; // 设置输出的压缩方法
    final CompressionType compType = SequenceFileOutputFormat.getOutputCompressionType(job); // 设置输出的路径
    Path out = FileOutputFormat.getOutputPath(job);
    // 这里是得到输出的三个目录名，crawl_parse,parse_data,parse_text
    Path text = new Path(new Path(out, ParseText.DIR_NAME), name);
    Path data = new Path(new Path(out, ParseData.DIR_NAME), name);
    Path crawl = new Path(new Path(out, CrawlDatum.PARSE_DIR_NAME), name);
    // 得到元数据的解析配置
    final String[] parseMDtoCrawlDB = job.get("db.parsemeta.to.crawldb","").split(" *, *");
    // 生成parse_text目录的输出方法
    final MapFile.Writer textOut = new MapFile.Writer(job, fs, text.toString(), Text.class, ParseText.class, CompressionType.RECORD, progress);
    // 生成parse_data目录的输出方法
    final MapFile.Writer dataOut = new MapFile.Writer(job, fs, data.toString(), Text.class, ParseData.class, compType, progress);
    // 生成crawl_parse的输出方法
    final SequenceFile.Writer crawlOut = SequenceFile.createWriter(fs, job, crawl, Text.class, CrawlDatum.class, compType, progress);
    // 这里使用了inner class
    return new RecordWriter<Text, Parse>() {           
        // 实现writer方法，写出<key,value>到指定的输出源
        public void write(Text key, Parse parse) throws IOException {
            String fromUrl = key.toString();
            String fromHost = null;
            String toHost = null;                           
            // 输出解析后的文本到parse_text目录
            textOut.append(key, new ParseText(parse.getText()));
   
            ParseData parseData = parse.getData();      
            // 这里抓取的网页内容是否有唯一的标记，如果有的话，用这个标记再生成一个CrawlDatum，输出到crawl_parse目录去
            // recover the signature prepared by Fetcher or ParseSegment
            String sig = parseData.getContentMeta().get(Nutch.SIGNATURE_KEY);
            if (sig != null) {
                byte[] signature = StringUtil.fromHexString(sig);
                if (signature != null) {
                    // append a CrawlDatum with a signature
                    CrawlDatum d = new CrawlDatum(CrawlDatum.STATUS_SIGNATURE, 0);
                    d.setSignature(signature);
                    crawlOut.append(key, d); // 输出到crawl_parse目录中去
                }
            }
   
            // see if the parse metadata contain things that we'd like
            // to pass to the metadata of the crawlDB entry
            // 查看解析的内容中是否包括设置的元数据信息，如果包含定义的元数据，那就新生成一个CrawlDatum，输出到crawl_parse目录
            CrawlDatum parseMDCrawlDatum = null;
            for (String mdname : parseMDtoCrawlDB) {
                String mdvalue = parse.getData().getParseMeta().get(mdname);
                if (mdvalue != null) {
                    if (parseMDCrawlDatum == null) parseMDCrawlDatum = new CrawlDatum(CrawlDatum.STATUS_PARSE_META, 0);
                    parseMDCrawlDatum.getMetaData().put(new Text(mdname), new Text(mdvalue));
                }
            }
            // 输出新生成的CrawlDatum
            if (parseMDCrawlDatum != null) crawlOut.append(key, parseMDCrawlDatum);
            // 这一块是处理页面的重定向的，如果当前url被重定向的了，并且这个重定向后的url没有被过滤
            // 那新生成一个CrawlDatum，输出到crawl_parse目录
            try {
                ParseStatus pstatus = parseData.getStatus();
                if (pstatus != null && pstatus.isSuccess() && pstatus.getMinorCode() == ParseStatus.SUCCESS_REDIRECT) {
                    String newUrl = pstatus.getMessage();
                    int refreshTime = Integer.valueOf(pstatus.getArgs()[1]);
                    try {
                        newUrl = normalizers.normalize(newUrl, URLNormalizers.SCOPE_FETCHER);
                    } catch (MalformedURLException mfue) {
                        newUrl = null;
                    }
                    if (newUrl != null) newUrl = filters.filter(newUrl);
                    String url = key.toString();
                    if (newUrl != null && !newUrl.equals(url)) {
                        String reprUrl = URLUtil.chooseRepr(url, newUrl, refreshTime < Fetcher.PERM_REFRESH_TIME);
                        CrawlDatum newDatum = new CrawlDatum();
                        newDatum.setStatus(CrawlDatum.STATUS_LINKED);
                        if (reprUrl != null && !reprUrl.equals(newUrl)) {
                            newDatum.getMetaData().put(Nutch.WRITABLE_REPR_URL_KEY, new Text(reprUrl));
                        }
                        crawlOut.append(new Text(newUrl), newDatum);
                    }
                }
            } catch (URLFilterException e) {
                // ignore
            }        
            // 这一块主要是处理外链接的
            // collect outlinks for subsequent db update
            Outlink[] links = parseData.getOutlinks();                   // 得到要存储的外链接数量
            int outlinksToStore = Math.min(maxOutlinks, links.length);
            if (ignoreExternalLinks) {
                try {                      // 得到当前url的host
                    fromHost = new URL(fromUrl).getHost().toLowerCase();
                } catch (MalformedURLException e) {
                    fromHost = null;
                }
            } else {
                fromHost = null;
            }
            // 这一块主要是对链接进行过滤，规格化
            int validCount = 0;
            CrawlDatum adjust = null;
            List<Entry<Text, CrawlDatum>> targets = new ArrayList<Entry<Text, CrawlDatum>>(outlinksToStore);
            List<Outlink> outlinkList = new ArrayList<Outlink>(outlinksToStore);
            for (int i = 0; i < links.length && validCount < outlinksToStore; i++) {
                String toUrl = links[i].getToUrl();
                // ignore links to self (or anchors within the page)
                if (fromUrl.equals(toUrl)) {
                    continue;
                }
                if (ignoreExternalLinks) {
                    try {
                        toHost = new URL(toUrl).getHost().toLowerCase();
                    } catch (MalformedURLException e) {
                        toHost = null;
                    }
                    if (toHost == null || !toHost.equals(fromHost)) { // external links
                        continue; // skip it
                    }
                }
                try {
                    toUrl = normalizers.normalize(toUrl,URLNormalizers.SCOPE_OUTLINK); // normalize the url
                    toUrl = filters.filter(toUrl);                                     // filter the url
                    if (toUrl == null) {
                        continue;
                    }
                } catch (Exception e) {
                    continue;
                }
                // 生成新的CrawlDatum，初始化其抓取间隔与分数
                CrawlDatum target = new CrawlDatum(CrawlDatum.STATUS_LINKED, interval);
                Text targetUrl = new Text(toUrl);
                try {
                    scfilters.initialScore(targetUrl, target);
                } catch (ScoringFilterException e) {
                    LOG.warn("Cannot filter init score for url " + key + ", using default: " + e.getMessage());
                    target.setScore(0.0f);
                }
                //放入目标容器，用于后面计算每一个外链接的分数
                targets.add(new SimpleEntry(targetUrl, target));
                outlinkList.add(links[i]);
                validCount++;
            }
            try {
                // compute score contributions and adjustment to the original score
                // 计算每一个外链接的贡献值，用来调整原url的分数
                adjust = scfilters.distributeScoreToOutlinks((Text)key, parseData, targets, null, links.length);
            } catch (ScoringFilterException e) {
                LOG.warn("Cannot distribute score from " + key + ": " + e.getMessage());
            }        
            // 输出链接到crawl_parse目录中
            for (Entry<Text, CrawlDatum> target : targets) {
                crawlOut.append(target.getKey(), target.getValue());
            }
            // 看源url是否有调整，有的话就输出到crawl_parse目录中
            if (adjust != null) crawlOut.append(key, adjust);
            // 得到过滤后的外链接
            Outlink[] filteredLinks = outlinkList.toArray(new Outlink[outlinkList.size()]);               
            // 生成新的ParseData对象
            parseData = new ParseData(parseData.getStatus(), parseData.getTitle(), filteredLinks,
                                           parseData.getContentMeta(), parseData.getParseMeta());
            // 写出到parse_data目录中
            dataOut.append(key, parseData);                      
            // 判断解析的数据是否来由当前原url,如果不是，那新生成一个CrawlDatum,输出到crawl_parse目录中
            if (!parse.isCanonical()) {
                CrawlDatum datum = new CrawlDatum();
                datum.setStatus(CrawlDatum.STATUS_FETCH_SUCCESS);
                String timeString = parse.getData().getContentMeta().get(Nutch.FETCH_TIME_KEY);
                try {
                    datum.setFetchTime(Long.parseLong(timeString));
                } catch (Exception e) {
                    LOG.warn("Can't read fetch time for: " + key);
                    datum.setFetchTime(System.currentTimeMillis());
                }
                crawlOut.append(key, datum);
            }
        }
    }
}
{% endhighlight %}

这里主要看了一下`ParseSegment`的实现流程和分析了一下其源代码，其中用到了`OutputFormat`的多路输出方法，这里还实现了对于源链接分数的调整算法，使用了插件中的一个叫scoring-opic的插件，叫`OPICScoringFilter`，全称叫Online Page Importance Computation。