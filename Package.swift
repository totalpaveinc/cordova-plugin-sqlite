// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "@totalpave/cordova-plugin-sqlite",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "@totalpave/cordova-plugin-sqlite",
            type: .static,
            targets: ["@totalpave/cordova-plugin-sqlite"])
    ],
    dependencies: [
        .package(url: "https://github.com/apache/cordova-ios.git", from: "8.0.0"),
        .package(url: "https://github.com/totalpaveinc/sqlite", exact: "0.4.5")
    ],
    targets: [
        .target(
            name: "@totalpave/cordova-plugin-sqlite",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "sqlite", package: "sqlite")
            ],
            path: "src/ios",
            sources: [
                "Database.h",       "Database.mm",
                "SQLite.h",         "SQLite.m",
                "Error.h",
                "ErrorUtility.h",   "ErrorUtility.m",
                "Logger.h",         "Logger.m"
            ],
            publicHeadersPath: "."
        )
    ]
)