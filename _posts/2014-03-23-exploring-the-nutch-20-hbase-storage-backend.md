---
layout: post
title: "Exploring the Nutch 2.0 HBase Storage Backend"
category: Nutch
tags: [nutch, nutch2, hbase]
---
According to the Nutch2Roadmap Wiki Page, one of the features of (as yet unreleased, but available in SVN) Nutch 2.0 is Storage Abstraction. Instead of segment files, it can use a MySQL or HBase (support for Cassandra is also planned) as its backend datastore.
Support for multiple backends is achieved using GORA, an ORM framework (originally written for Nutch) that works against Column databases. So changing backends would (probably, haven't looked at the GORA code yet) mean adding the appropriate GORA implementation JAR into Nutch's classpath.
Currently, even though the code is pre-release, there is a working HBase backend, and adequate documentation on how to set it up. Since we use Cassandra as part of our crawl/indexing infrastructure, I figured it would be worth checking out, so once Nutch 2.0 is out, maybe we could use it with the Cassandra backend.
So this post is basically an attempt to figure out what Nutch does to the HBase datastore as each of its subcommands are run. You can find the list of subcommands here.
The first step is to download Nutch 2.0 and GORA sources, and build them. This page has detailed instructions, which I followed almost to the letter. The only things to remember is to set the GORA backend in conf/nutch-site.xml after generating the nutch runtime.
Two other changes are to set the http.agent.name and http.robots.agents in nutch-default.xml (so nutch actually does the crawl), and the hbase.rootdir in hbase-default.xml to something other than /tmp (to prevent data loss across system restarts).
I just ran a subset of Nutch commands (we use Nutch for crawling, not its indexing and search functionality), and looked at what happened in the HBase datastore as a result. The attempt was to understand what each Nutch command does and correlate it to the code, so I can write similar code to hook into various phases of the Nutch lifecycle.
First, we have to start up HBase so Nutch can write to it. Part of the Nutch/GORA integration instructions was to install HBase, so now we can start up a local instance, and then login to the HBase shell.

{% highlight bash %}
sujit@cyclone:~$ cd /opt/hbase-0.20.6
sujit@cyclone:hbase-0.20.6$ bin/start-hbase.sh 
localhost: starting zookeeper, logging to /opt/hbase-0.20.6/bin/../logs/hbase-sujit-zookeeper-cyclone.hl.local.out
starting master, logging to /opt/hbase-0.20.6/bin/../logs/hbase-sujit-master-cyclone.hl.local.out
localhost: starting regionserver, logging to /opt/hbase-0.20.6/bin/../logs/hbase-sujit-regionserver-cyclone.hl.local.out
sujit@cyclone:hbase-0.20.6$ bin/hbase shell
HBase Shell; enter 'help<RETURN>' for list of supported commands.
Version: 0.20.6, r965666, Mon Jul 19 15:48:07 PDT 2010
hbase(main):001:0> list
0 row(s) in 0.1090 seconds
hbase(main):002:0> 
{% endhighlight %}

We use a single URL (this blog) as the seed URL. So we create a one-line file as shown below:

<div class="bs-callout bs-callout-info">http://sujitpal.blogspot.com/</div>

and then inject this URL into HBase:

{% highlight bash %}
sujit@cyclone:local$ bin/nutch inject /tmp/seed.txt
{% endhighlight %}

This results in a single table called "webpage" being created in HBase, with the following structure. I used list to list the tables, and scan to list the contents of the table. For ease of understanding, I reformatted the output manually into a JSON structure. Each leaf level column (cell in HBase-speak) consists of a (key, timestamp, value) triplet, so we could have written the first leaf more compactly as {f1 : "\x00'\x80\x00"}.
It might help to refer to the conf/gora-hbase-mapping.xml file in your Nutch runtime as you read this. If you haven't set up Nutch 2.0 locally, then this information is also available in the GORA_HBase wiki page.

{% highlight json %}
webpage : {
  key : "com.blogspot.sujitpal:http/",
  f : {
    fi : {
      timestamp : 1293676557658,
      value : "\x00'\x8D\x00"
    },
    ts : {
      timestamp : 1293676557658,
      value : "\x00\x00\x01-5!\x9D\xE5"
    }
  },
  mk : {
    _injmrk_ : {
      timestamp : 1293676557658, 
      value : "y"
    }
  },
  mtdt : {
    _csh_ : {
      timestamp : 1293676557658, 
      value : "x80\x00\x00"
    }
  },
  s : {
    s : {
      timestamp : 1293676557658, 
      value : "x80\x00\x00"
  }
}
{% endhighlight %}

I then run the generate command, which generates the fetchlist:

<div class="bs-callout bs-callout-info">
	<p>sujit@cyclone:local$ bin/nutch generate</p>
	<p>GeneratorJob: Selecting best-scoring urls due for fetch.</p>
	<p>GeneratorJob: starting</p>
	<p>GeneratorJob: filtering: true</p>
	<p>GeneratorJob: done</p>
	<p>GeneratorJob: generated batch id: 1293732622-2092819984</p>
</div>

This creates an additional column "mk:_gnmrk_" containing the batch id, in the webpage table for the record keyed by the seed URL.

{% highlight json %}
webpage : {
  key : "com.blogspot.sujitpal:http/",
  f : {
    fi : {
      timestamp : 1293676557658,
      value : "\x00'\x8D\x00"
    },
    ts : {
      timestamp : 1293676557658,
      value : "\x00\x00\x01-5!\x9D\xE5"
    }
  },
  mk : {
    _injmrk_ : {
      timestamp : 1293676557658, 
      value : "y"
    },
    _gnmrk_ : {
      timestamp=1293732629430, 
      value : "1293732622-2092819984"
    }
  },
  mtdt : {
    _csh_ : {
      timestamp : 1293676557658, 
      value : "x80\x00\x00"
    }
  },
  s : {
    s : {
      timestamp : 1293676557658, 
      value : "x80\x00\x00"
    }
  }
}
{% endhighlight %}

Next I ran a fetch with the batch id returned by the generate command:

{% highlight bash %}
sujit@cyclone:local$ bin/nutch fetch 1293732622-2092819984
FetcherJob: starting
FetcherJob : timelimit set for : -1
FetcherJob: threads: 10
FetcherJob: parsing: false
FetcherJob: resuming: false
FetcherJob: batchId: 1293732622-2092819984
Using queue mode : byHost
Fetcher: threads: 10
QueueFeeder finished: total 1 records. Hit by time limit :0
fetching http://sujitpal.blogspot.com/
-finishing thread FetcherThread1, activeThreads=1
-finishing thread FetcherThread2, activeThreads=1
-finishing thread FetcherThread3, activeThreads=1
-finishing thread FetcherThread4, activeThreads=1
-finishing thread FetcherThread5, activeThreads=1
-finishing thread FetcherThread6, activeThreads=1
-finishing thread FetcherThread7, activeThreads=1
-finishing thread FetcherThread8, activeThreads=1
-finishing thread FetcherThread9, activeThreads=1
-finishing thread FetcherThread0, activeThreads=0
-activeThreads=0, spinWaiting=0, fetchQueues= 0, fetchQueues.totalSize=0
-activeThreads=0
FetcherJob: done
{% endhighlight %}

This creates some more columns as shown below. As you can see, it creates additional columns under the "f" column family, most notably the raw page content in the "f:cnt" column and a new "h" column family with page header information. It also creates a batch id marker in the "mk" column family.

{% highlight json %}
webpage : {
  key : "com.blogspot.sujitpal:http/",
  f : {
    bas : {
      timestamp : 1293732801833, 
      value : "http://sujitpal.blogspot.com/"
    },
    cnt : {
      timestamp : 1293732801833, 
      value : "DOCTYPE html PUBLIC "-//W3C//DTD X...rest of page content"
    },
    fi : {
      timestamp : 1293676557658,
      value : "\x00'\x8D\x00"
    },
    prot : {
      timestamp : 1293732801833, 
      value : "x02\x00\x00"
    },
    st : {
      timestamp : 1293732801833, 
      value : "x00\x00\x00\x02"
    },
    ts : {
      timestamp : 1293676557658,
      value : "\x00\x00\x01-5!\x9D\xE5"
    }
    typ : {
      timestamp : 1293732801833, 
      value : "application/xhtml+xml"
    }
  },
  h : {
    Cache-Control : {
      timestamp : 1293732801833, 
      value : "private"
    },
    Content-Type : {
      timestamp : 1293732801833, 
      value : "text/html; charset=UTF-8"
    },
    Date : {
      timestamp : 1293732801833, 
      value : "Thu, 30 Dec 2010 18:13:21 GMT"
    },
    ETag : {
      timestamp : 1293732801833, 
      value : 40bdf8b9-8c0a-477e-9ee4-b19995601dde"
    },
    Expires : {
      timestamp : 1293732801833, 
      value : "Thu, 30 Dec 2010 18:13:21 GMT"
    },
    Last-Modified : {
      timestamp : 1293732801833, 
      value : "Thu, 30 Dec 2010 15:01:20 GMT"
    },
    Server : {
      timestamp : 1293732801833, 
      value : "GSE"
    },
    Set-Cookie : {
      timestamp : 1293732801833, 
      value : "blogger_TID=130c0c57a66d0704;HttpOnly"
    },
    X-Content-Type-Options : {
      timestamp : 1293732801833, 
      value : "nosniff"
    },
    X-XSS-Protection : {
      timestamp : 1293732801833, 
      value : "1; mode=block"
    }
  },
  mk : {
    _injmrk_ : {
      timestamp : 1293676557658, 
      value : "y"
    },
    _gnmrk_ : {
      timestamp=1293732629430, 
      value : "1293732622-2092819984"
    },
    _ftcmrk_ : {
      timestamp : 1293732801833, 
      value : "1293732622-2092819984"
    }
  },
  mtdt : {
    _csh_ : {
      timestamp : 1293676557658, 
      value : "x80\x00\x00"
    }
  },
  s : {
    s : {
      timestamp : 1293676557658, 
      value : "x80\x00\x00"
    }
  }
}
{% endhighlight %}

Finally we parse the fetched content. This extracts the links and parses the text content out of the HTML.

{% highlight bash %}
sujit@cyclone:local$ bin/nutch parse 1293732622-2092819984
ParserJob: starting
ParserJob: resuming: false
ParserJob: forced reparse: false
ParserJob: batchId: 1293732622-2092819984
ParserJob: success
{% endhighlight %}

This results in more columns written out to the webpage table. At this point it parses out the links from the page and stores them in the "ol" (outlinks) column family, and the "p" column family, which contains the parsed content for the page.

{% highlight json %}
webpage : {
  key : "com.blogspot.sujitpal:http/",
  f : {
    bas : {
      timestamp : 1293732801833, 
      value : "http://sujitpal.blogspot.com/"
    },
    cnt : {
      timestamp : 1293732801833, 
      value : "DOCTYPE html PUBLIC "-//W3C//DTD X...rest of page content"
    },
    fi : {
      timestamp : 1293676557658,
      value : "\x00'\x8D\x00"
    },
    prot : {
      timestamp : 1293732801833, 
      value : "x02\x00\x00"
    },
    st : {
      timestamp : 1293732801833, 
      value : "x00\x00\x00\x02"
    ts : {
      timestamp : 1293676557658,
      value : "\x00\x00\x01-5!\x9D\xE5"
    }
    typ : {
      timestamp : 1293732801833, 
      value : "application/xhtml+xml"
    }
  },
  h : {
    Cache-Control : {
      timestamp : 1293732801833, 
      value : "private"
    },
    Content-Type : {
      timestamp : 1293732801833, 
      value : "text/html; charset=UTF-8"
    },
    Date : {
      timestamp : 1293732801833, 
      value : "Thu, 30 Dec 2010 18:13:21 GMT"
    },
    ETag : {
      timestamp : 1293732801833, 
      value : 40bdf8b9-8c0a-477e-9ee4-b19995601dde"
    },
    Expires : {
      timestamp : 1293732801833, 
      value : "Thu, 30 Dec 2010 18:13:21 GMT"
    },
    Last-Modified : {
      timestamp : 1293732801833, 
      value : "Thu, 30 Dec 2010 15:01:20 GMT"
    },
    Server : {
      timestamp : 1293732801833, 
      value : "GSE"
    },
    Set-Cookie : {
      timestamp : 1293732801833, 
      value : "blogger_TID=130c0c57a66d0704;HttpOnly"
    },
    X-Content-Type-Options : {
      timestamp : 1293732801833, 
      value : "nosniff"
    },
    X-XSS-Protection : {
      timestamp : 1293732801833, 
      value : "1; mode=block"
    }
  },
  mk : {
    _injmrk_ : {
      timestamp : 1293676557658, 
      value : "y"
    },
    _gnmrk_ : {
      timestamp=1293732629430, 
      value : "1293732622-2092819984"
    },
    _ftcmrk_ : {
      timestamp : 1293732801833, 
      value : "1293732622-2092819984"
    },
    __prsmrk__ : {
      timestamp : 1293732957501, 
      value : "1293732622-2092819984"
    }
  },
  mtdt : {
    _csh_ : {
      timestamp : 1293676557658, 
      value : "x80\x00\x00"
    }
  },
  s : {
    s : {
      timestamp : 1293676557658, 
      value : "x80\x00\x00"
    }
  }
  ol : {
    http://pagead2.googlesyndication.com/pagead/show_ads.js : {
      timestamp : 1293732957501, 
      value : ""
    },
    http://sujitpal.blogspot.com/ : {
      timestamp : 1293732957501, 
      value : "Home"
    },
    http/ column=ol:http://sujitpal.blogspot.com/2005_03_01_archive.html : {
      timestamp : 1293732957501, 
      value : "March"
    },
    // ... (more outlinks below) ...
  },
  p : {
    c : {
      timestamp : 1293732957501, 
      value : "Salmon Run skip to main ... (rest of parsed content)"
    },
    sig : {
      timestamp : 1293732957501, 
      value="cW\xA5\xB7\xDD\xD3\xBF`\x80oYR8\x1F\ x80\x16"
    },
    st : {
      timestamp : 1293732957501, 
      value : "\x02\x00\x00"
    },
    t : {
      timestamp : 1293732957501, 
      value : "Salmon Run"
    },
    s : {
      timestamp : 1293732629430, 
      value : "?\x80\x00\x00"
    }
  }
}
{% endhighlight %}

We then run the updatedb command to add the outlinks discovered during the parse to the list of URLs to be fetched.

{% highlight bash %}
sujit@cyclone:local$ bin/nutch updatedb
DbUpdaterJob: starting
DbUpdaterJob: done
{% endhighlight %}

This results in 152 rows in the HBase table. Each of the additional rows correspond to the outlinks discovered during the parse stage above.

{% highlight bash %}
hbase(main):010:0> scan "webpage"
...
152 row(s) in 1.0400 seconds
hbase(main):011:0>
{% endhighlight %}

We can then go back to doing fetch, generate, parse and update until we are done crawling to the desired depth.
Thats all for today. Happy New Year and hope you all had fun during the holidays. As I have mentioned above, this exercise was for me to understand what Nutch does to the HBase datastore when each command is invoked. In coming weeks, I plan on using this information to write some plugins that would drop "user" data into the database, and use it in later steps.