cordova-plugin-sqlite
=====================

SQLite plugin for cordova. Native binaries are linked against a shared library available from our [SQLite Binaries](https://github.com/totalpaveinc/sqlite-bin) repository.

If your application includes multiple native libraries that uses SQLite, it's important to ensure that they dynamically link SQLite and use a single copy of SQLite, especially if they share the same underlying database resource.

Refer to [SQLite Question](https://sqlite.org/forum/forumpost/dbf245f2b7) and [Section 2.2](https://www.sqlite.org/howtocorrupt.html#posix_close_bug) of how to corrupt a database.

## SQLite Compilation

SQLite has been compiled with version 3.39.2 for the following architectures:
 
 - Android
 - - arm64-v8a
 - - armeabi-v7a
 - - x86
 - - x86_64
 - iOS
 - - arm64
 - - x86_64 (iPhone Simulator SDK)

SQLite is compiled with the following flags:
 
 - SQLITE_ENABLE_COLUMN_METADATA
 - SQLITE_NOHAVE_SYSTEM

## Android Notes

The NDK binaries are compiled with API 24, therefore Min API SDK 24 is required by the application.

## Documentation

See [Docs](./Docs.md)

## Licenses

This plugin is licensed under Apache 2.0. See [LICENSE](./LICENSE) for more information.

The [SQLite binaries](https://www.sqlite.org/copyright.html) are available under [public domain](https://en.wikipedia.org/wiki/Public_domain).
