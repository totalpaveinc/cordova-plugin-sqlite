#!/bin/bash

cd ../..
rm -f ./*.tgz

npm run build
npm pack

ANDROID_VERSION=15
IOS_VERSION=8

plugin=`ls *.tgz`

cd test/sqliteTestApp

cordova plugin remove @totalpave/cordova-plugin-sqlite
cordova plugin remove @totalpave/cordova-plugin-libsqlite
cordova plugin remove @totalpave/cordova-plugin-libcxx

rm -rf plugins/@totalpave/cordova-plugin-sqlite
rm -rf plugins/@totalpave/cordova-plugin-libsqlite
rm -rf plugins/@totalpave/cordova-plugin-libcxx

cordova platform remove android
cordova platform remove ios

cordova plugin add file:../../$plugin
cordova platform add android@$ANDROID_VERSION
cordova platform add ios@$IOS_VERSION
