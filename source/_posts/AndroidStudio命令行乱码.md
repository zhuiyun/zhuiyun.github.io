---
layout: post
title: 解决AndroidStudio的命令行乱码
date: 2019.7.31
body: [article,  comments]
toc: true
tag: [Android,问题解决]
categories: [Android]
---

#解决AndroidStudio命令行乱码

## 现象
用的macbook,下载了iTerm2后,根据网上博客配置了一些属性,之后打开Androidstudio时,发现命令行乱码,鼓捣了一阵终于搞定
 <!-- more -->
## 解决
这个情况主要是修改了命令行的字体,但Androidstudio中有默认字体,两者不是同一个造成的,只需修改其中之一即可,我改的是Androidstudio.修改位置如下图:
![](https://i.loli.net/2019/07/31/5d4168e4e131675700.png)
需要和iTerm2中字体一致
![](https://i.loli.net/2019/07/31/5d41688ed76d781045.png)

