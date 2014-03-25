---
layout: post
title: "MySQL Related"
category: MySQL
tags: [mysql, communication]
---

## Mysql 通信协议分析 {#communication}

客户端与服务端通信用到的主要结构是st_net,别名为NET

{% highlight c %}
typedef struct st_net {
    Vio* vio;
    unsigned char *buff,*buff_end,*write_pos,*read_pos;
    my_socket fd; /* For Perl DBI/dbd */
    unsigned long max_packet,max_packet_size;
    unsigned int pkt_nr,compress_pkt_nr;
    unsigned int write_timeout, read_timeout, retry_count;
    int fcntl;
    my_bool compress;
    /*
        The following variable is set if we are doing several queries in one
        command ( as in LOAD TABLE ... FROM MASTER ),
        and do not want to confuse the client with OK at the wrong time
    */
    unsigned long remain_in_buf,length, buf_length, where_b;
    unsigned int *return_status;
    unsigned char reading_or_writing;
    char save_char;
    my_bool no_send_ok; /* For SPs and other things that do multiple stmts */
    my_bool no_send_eof; /* For SPs' first version read-only cursors */
    /*
        Pointer to query object in query cache, do not equal NULL (0) for
        queries in cache that have not stored its results yet
    */
    char last_error[MYSQL_ERRMSG_SIZE], sqlstate[SQLSTATE_LENGTH+1];
    unsigned int last_errno;
    unsigned char error;
    gptr query_cache_query;
    my_bool report_error; /* We should report error (we have unreported error) */
    my_bool return_errno;
} NET;
{% endhighlight %}

buffer成员变量用于存放服务端或客户端的数据包，这些包像所有通信包一样拥有固定的格式，包含统一的header和数据主体

## Schema与数据类型优化 {#schema-optimize}

### 选择优化的数据类型

> * 更小的通常更好，应该尽量使用可以正确存储数据的最小数据类型。
> * 简单就好，简单数据类型的操作通常需要更少的CPU周期，整型比较代价要小于字符串比较的代价。
> * 尽量避免NULL，最好指定列为NOT NULL，除非该列需要存NULL值。

### 尽量保持Schema的简单

> * 尽量避免过度设计，例如会导致极其复杂查询的schema设计，或者有很多列表的设计。
> * 使用小而简单的合适数据类型，除非真是数据模型中有确切的需要，否则应尽可能地避免使用NULL值。
> * 尽量使用相同的数据类型存储相似或相关的值，尤其是要在关联条件中使用的列。
> * 注意可变长字符串，其在临时表或排序时可能导致悲观的按最大长度分配内存。
> * 尽量使用整型定义主键。
> * 避免使用mysql已遗弃的特性，例如指定浮点数的精度，或者整数的显示宽度
> * 小心使用ENUM和SET。虽然他们用起来很方便，但不能滥用，最好使用BIT代替。