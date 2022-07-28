---
layout: post
title: "Recover deleted files from git history"
tags: [git]
comments: true
---

### Recover deleted files from git history
```
//최근 삭제된 파일 리스트 보기
git log --diff-filter=D --summary

//삭제된 특정 파일에 대한 로그확인
git log ccp/cms/www/www/design/common/images/etc/blank_images.zip

//아래 commit 으로 삭제된 것을 확인
git show 8493334cb0e2c055507bd9534d5ea5ca877a7b45

//해당 커밋 바로앞 ^ 데이터를 가져옴
git checkout 8493334^ -- "ccp/cms/www/www/design/common/images/etc/blank_images.zip"

//새로 커밋
git add .
git commit -m 'recovery'

```
