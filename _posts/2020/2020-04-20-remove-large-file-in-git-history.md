---
layout: post
title: "Remove large file in git history"
tags: [git]
comments: true
---

### largeFileCheck.sh
```
#!/bin/bash
#set -x

# Shows you the largest objects in your repo's pack file.
# Written for osx.
#
# @see https://stubbisms.wordpress.com/2009/07/10/git-script-to-show-largest-pack-objects-and-trim-your-waist-line/
# @author Antony Stubbs

# set the internal field separator to line break, so that we can iterate easily over the verify-pack output
IFS=$'\n';

# list all objects including their size, sort by size, take top 10
objects=`git verify-pack -v .git/objects/pack/pack-*.idx | grep -v chain | sort -k3nr | head`

echo "All sizes are in kB's. The pack column is the size of the object, compressed, inside the pack file."

output="size,pack,SHA,location"
allObjects=`git rev-list --all --objects`
for y in $objects
do
    # extract the size in bytes
    size=$((`echo $y | cut -f 5 -d ' '`/1024))
    # extract the compressed size in bytes
    compressedSize=$((`echo $y | cut -f 6 -d ' '`/1024))
    # extract the SHA
    sha=`echo $y | cut -f 1 -d ' '`
    # find the objects location in the repository tree
    other=`echo "${allObjects}" | grep $sha`
    #lineBreak=`echo -e "\n"`
    output="${output}\n${size},${compressedSize},${other}"
done

echo -e $output | column -t -s ', '
```

### largeFileCheck.sh Result
```
All sizes are in kB's. The pack column is the size of the object, compressed, inside the pack file.
size    pack    SHA                                       location
221928  220165  1cc85c7b3eb1d7bd604add9e7112a83394a8d693  ccp/nps/ycl/bin.zip
85065   85065   cd80b2a868667f264cff2091c9431b5617abe702  mmp/mus/gradle/wrapper/dists/gradle-5.4.1-bin.zip
68128   26237   108dde14d33efc2a3050477cada15c01ae2e516e  ccp/ycl/cli/YNAClientEx.VC.db
68060   25732   acdde3065f37cc0230b9ed1644750ca5b2e262c5  ccp/ycl/cli/YNAClientEx/YNAClientEx.VC.db
47072   1932    9002e757c27f121adc51d407792f10c019e0a653  nsp/database/oracle/ORACLE_BASECODE_INSERT.SQL
39727   15939   c99d37fd7287079b324268734afdaff5cd627e03  ccp/nps/xed/src/main/resources/ffmpeg/ffmpeg.exe
23807   9175    01ee574bf35611552bbc4945834d7e9d8d5b288a  nsp/mas/map/ima/enpba/Pods/GoogleAppMeasurement/Frameworks/GoogleAppMeasurement.framework/GoogleAppMeasurement
21641   1802    554437bcdce2a336ac9f79906bd9e78e7243f671  ccp/nps/nws/database/nzmgr_snd_data_insert.sql
15650   2362    15b3a724f4ed65f9a21e65602755eba42caf4e24  ccp/nps/nws/YNANWS_WEB/WebContent/jsp/yh_news_jsp_20150204.tar
9562    1352    5a9ae36d11233f7d2c2f7ee6b1bd4bc1fc173480  ccp/cms/web/db/temp_insert_codedata.dmp
```

### remove Large file in git history
```
//remove large file in git history
------------------------------------------------------------------------------------------------------------------------------------------------------------------------

git log --diff

#mirror repository [ require : --mirror ]
git clone --mirror http://~~~/~~~/~~~.git

#폴더이동
cd meps.git

#파일 삭제 211MB
bfg --delete-files "bin.zip"

#같은 이름 파일 두개 66.53MB, 66.46MB
bfg --delete-files "YNAClientEx.VC.db"

git reflog expire --expire=now --all
git gc --prune=now --aggressive

#master 가 protected 인경우는 unprotected 처리후 push 가능함
git push
```

--- 

