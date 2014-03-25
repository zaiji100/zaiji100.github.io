---
layout: post
title: "ParserJob - Nutch2"
category: Nutch
tags: [hadoop, nutch, map-reduce, parse, nutch2]
---
ParserJob和FetcherJob一样也需要指定batchId来选择本次解析的WebPages

## 任务配置 {#job-configuration}

{% highlight java %}
// 获取batchId，以及Resume和force设置
...
currentJob = new NutchJob(getConf(), "parse");
    
Collection<WebPage.Field> fields = getFields(currentJob);
// 设置Mapper和Reducer
StorageUtils.initMapperJob(currentJob, fields, String.class, WebPage.class,
       ParserMapper.class);
StorageUtils.initReducerJob(currentJob, IdentityPageReducer.class);
// 禁用Reducer
currentJob.setNumReduceTasks(0);
 
currentJob.waitForCompletion(true);
ToolUtil.recordJobStatus(null, currentJob, results);
{% endhighlight %}

## Mapper

{% highlight java %}
@Override
public void map(String key, WebPage page, Context context)
        throws IOException, InterruptedException {
      Utf8 mark = Mark.FETCH_MARK.checkMark(page);
      String unreverseKey = TableUtil.unreverseUrl(key);
      // 判断batchId是否是reparse，如果是，重新parse该page，否则判断是否与page中的batchId一致
      if (batchId.equals(REPARSE)) {
         LOG.debug("Reparsing " + unreverseKey);
      } else {
         if (!NutchJob.shouldProcess(mark, batchId)) {
            LOG.info("Skipping " + TableUtil.unreverseUrl(key) + "; different batch id (" + mark + ")");
            return;
         }
         if (shouldResume && Mark.PARSE_MARK.checkMark(page) != null) {
            // 如果已经解析过该page，并设置为Resume状态，跳过该page
            if (force) {
               // force模式下，强制解析所有page
               LOG.info("Forced parsing " + unreverseKey + "; already parsed");
            } else {
               LOG.info("Skipping " + unreverseKey + "; already parsed");
               return;
            }
         } else {
            LOG.info("Parsing " + unreverseKey);
         }
      }
 
      if (skipTruncated && isTruncated(unreverseKey, page)) {
         return;
      }
      // 是用插件中的Parse设置该解析该page
      parseUtil.process(key, page);
      ParseStatus pstatus = page.getParseStatus();
      if (pstatus != null) {
         context.getCounter("ParserStatus",
            ParseStatusCodes.majorCodes[pstatus.getMajorCode()]).increment(1);
      }
      context.write(key, page);
   }   
}
{% endhighlight %}