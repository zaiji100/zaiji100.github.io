---
layout: post
title: "Java Concurrent"
category: JDK
tags: [jdk, concurrent, java, multi-thread, lock, synchronized]
---
* Thread: 在Java中提供了一个Thread类，该类封装了线程的行为。可以通过继承Thread并重写Thread的run方法来完成线程中需要完成的任务，并调用start方法开启该线程。
* Runnable: 如果具体要完成任务的线程类需要继承自其他类，可以选择实现Runnable，并实现run方法，利用该对象新建一个线程，并开启该线程。