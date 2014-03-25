---
layout: post
title: "Hibernate Shards"
category: Shards
tags: [shard, hibernate]
---
## 基本概念 {#basic-concept}

hibernate 中4个核心类

* `org.hibernate.Session`
* `org.hibernate.SessionFactory`
* `org.hibernate.Criteria`
* `org.hibernate.Query`

Hibernate Shards 针对这4个类分别提供了shards扩展，另外，它还提供了

* `org.hibernate.shards.strategy.selection.ShardSelectionStrategy`
* `org.hibernate.shards.strategy.resolution.ShardResolutionStrategy`
* `org.hibernate.shards.strategy.access.ShardAccessStrategy`

3个接口来控制shards策略

* `ShardAccessStrategy`：用来决定如何在shards中执行数据库操作：

<div class="bs-callout bs-callout-info">
hibernate默认提供的方式有SequentialShardAccessStrategy（顺序执行），LoadBalancedSequentialShardAccessStrategy（带负载均衡的顺序执行）和ParallelShardAccessStrategy（并发执行）
</div>

* `ShardSelectionStrategy`：用来决定一个新的object被创建在那个shard上
* `ShardResolutionStrategy`：用来决定对于一个给定ID，寻找其实体被存在哪些shards上

<div class="bs-callout bs-callout-info">
IDGenerator的使用取决于ShardResolutionStrategy的实现，两者是紧密联系在一起的
</div>

对于一个多级对象（一个对象中，包含其他复杂对象，而不只包含基本数据类型），hibernate shards只支持将根据其最高级别的对象ID来决定存放在那个shard，其子对象们保存在与其同一个shard中。

## Resharding

当数据增长到以前数据库（s）能力无法承受时，我们会希望添加数据库来减轻以前数据库的压力，我们会希望将部分数据迁移到其他数据库中，这个过程叫做resharding
Resharding包含两个任务：1.将一个object移动到另一个shard；2.改变object-shard mappings
通常情况下，resharding要求更改这个object的IDs和FKs，更极端的情况，你可能需要更改ShardResolutionStrategy实现(sad)
hibernate shards 针对此问题提出了virtual shards概念，在初始化sessionFactory时，创建多个virtual shards，并确立virtual shards与physical shards之间的mapping关系
我们设计shard策略时，只针对virtual shards编码，策略决定一个object存在哪个virtual shard上，当我们需要添加physical shards时，只需要更改virtual shards与physical shards之间的mapping关系即可

<div class="alert alert-info">该设计思路很巧妙，可以借鉴</div>

<img src="/assets/img/virtualshards.png" class="img-thumbnail">

## query

对于shards环境，数据库内部排序是比较困难的，所以需要Entity classes实现Comparable接口，如果你的entity classes没有实现该接口，会报exception

ps:使用Comparable的话，还会有性能问题

统计问题，对于求平均数，我们必须要知道单个shard中的记录数（hibernate就是这么做的) 同样是性能问题

## 局限性 {#limit}

可以看到hibernate shards目前还是有很多局限性的

1. 部分api未完成
2. 跨shards的对象结构
3. shards的事务（(sad)）
4. 实体的ids不能为基本类型
5. replication，目前仅支持横向切分，所以hibernate shards只适合用在只读或变化比较少的情景下