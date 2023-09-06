
@totalpave/cordova-plugin-sqlite
--------------------------------

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.3 (September 6, 2023)

- Added Foundation.h imports where needed to not rely on foreign headers to import things for the plugin.
- Fix iOS not extracting the ERROR_QUERY_KEY from NSError userInfo in the ErrorUtility.toDictionary API.

## 0.2.2 (August 22, 2023)

- Updated SQL Binaries for int64 support. 

## 0.2.1 (July 17, 2023)

-   Updated SQL Binaries which contains exposes an API to set the SQLite Temporary directory.
    This is used to support larger queries that may otherwise exhaust system RAM.
