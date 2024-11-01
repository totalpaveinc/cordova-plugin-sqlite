
#import "SQLite.h"
#import "Database.h"
#import "ErrorUtility.h"
#import "./Error.h"
#import <sqlite/sqlite.h>
#import "./Logger.h"

@implementation SQLite {
    NSMutableDictionary* $databases;
    Logger* $connectionLog;
}

- (void) pluginInitialize {
    self->$databases = [[NSMutableDictionary alloc] init];
    self->$connectionLog = [[Logger alloc] initWithSubSystem:SUBSYSTEM category:CONNECTION_LOG_CATEGORY];

    NSString* tempDir = NSTemporaryDirectory();
    NSString* sqliteTempDir = [tempDir stringByAppendingPathComponent:@"sqlite"];
    
    NSFileManager* fileManager = [NSFileManager defaultManager];
    NSError* error = nil;
    
    bool shouldSetTemp = false;
    
    if (![fileManager fileExistsAtPath:sqliteTempDir]) {
        if (![fileManager createDirectoryAtPath:sqliteTempDir withIntermediateDirectories:YES attributes:nil error:&error]) {
            NSLog(@"Failed to create sqlite temp directory. Large queries may fail fatally.\n%@", error);
            shouldSetTemp = true;
        }
    }
    else {
        shouldSetTemp = true;
    }
    
    // See https://www.sqlite.org/c3ref/temp_directory.html
    // for special notes around sqlite3_temp_directory global variable usage
    if (shouldSetTemp) {
        const char* cstring = [sqliteTempDir UTF8String];
        size_t length = strlen(cstring) + 1; // +1 for null terminator
        char* sqliteStr = (char*)sqlite3_malloc((int)length);
        strcpy(sqliteStr, cstring);
        
        sqlite3_temp_directory = sqliteStr;
    }
    else {
        sqlite3_temp_directory = NULL;
    }
}

- (void) open:(CDVInvokedUrlCommand*) command {
    [self.commandDelegate runInBackground:^{
        NSError* error;
        Database *db = [[Database alloc]
            initWithPath: [NSURL URLWithString: [command.arguments objectAtIndex:0]]
            openFlags: [[command.arguments objectAtIndex:1] intValue]
            busyTimeout: [[command.arguments objectAtIndex:2] intValue]
            error:&error
        ];
        if (error) {
            [self.commandDelegate
                sendPluginResult:[CDVPluginResult
                    resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
                ]
                callbackId:command.callbackId
            ];
        }
        else {
            NSNumber* handle = [db getHandle];
            [self->$databases setObject:db forKey:handle];
            [self->$connectionLog log:@"Connection Opened | Handle %@", [handle stringValue]];
            NSMutableDictionary* response = [[NSMutableDictionary alloc] init];
            [response setObject: [handle stringValue] forKey:@"dbHandle"];
            
            [self.commandDelegate
                sendPluginResult:[CDVPluginResult
                    resultWithStatus:CDVCommandStatus_OK
                    messageAsDictionary:response
                ]
                callbackId:command.callbackId
            ];
        }
    }];
}

- (void) query:(CDVInvokedUrlCommand*) command {
    NSString* sql = [command.arguments objectAtIndex:1];
    NSDictionary* params = [command.arguments objectAtIndex:2];
    
    NSNumberFormatter* numberFormatter = [[NSNumberFormatter alloc] init];
    NSString* handleStr = [[command.arguments objectAtIndex:0] objectForKey:@"dbHandle"];
    NSNumber* handle = [numberFormatter numberFromString: handleStr];
    [self->$connectionLog log:@"Connection Queried | Handle %@ | SQL - %@", [handle stringValue], sql];

    if (handle == nil) {
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Malformed handle"
            ]
            callbackId:command.callbackId
        ];
        return;
    }

    Database* db = [self->$databases objectForKey: handle];
    if (db == nil) {
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Database Not Found. Did you open your database before calling query?"
            ]
            callbackId:command.callbackId
        ];
        return;
    }
    else {
        [self.commandDelegate runInBackground:^{
            NSError* error;
            NSArray* results = [db run:sql params:params error:&error];
            if (error) {
                [self.commandDelegate
                    sendPluginResult:[CDVPluginResult
                        resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
                    ]
                    callbackId:command.callbackId
                ];
                return;
            }
            [self.commandDelegate
                sendPluginResult:[CDVPluginResult
                    resultWithStatus:CDVCommandStatus_OK
                    messageAsArray:results
                ]
                callbackId:command.callbackId
            ];
        }];
    }
}

- (void) close:(CDVInvokedUrlCommand*) command {
    NSNumberFormatter* numberFormatter = [[NSNumberFormatter alloc] init];
    NSString* handleStr = [[command.arguments objectAtIndex:0] objectForKey:@"dbHandle"];
    NSNumber* handle = [numberFormatter numberFromString: handleStr];
    
    if (handle == nil) {
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Malformed handle"
            ]
            callbackId:command.callbackId
        ];
        return;
    }
    
    Database* db = [self->$databases objectForKey: handle];
    if (db != nil) {
        [db close];
        [self->$databases removeObjectForKey:[db getHandle]];
    }
    [self->$connectionLog log:@"Connection Closed | Handle %@", [handle stringValue]];
    [self.commandDelegate
        sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
        callbackId:command.callbackId
    ];
}

- (void) bulkInsert:(CDVInvokedUrlCommand*) command {
    NSString* sql = [command.arguments objectAtIndex:1];
    NSArray* params = [command.arguments objectAtIndex:2];
    NSNumberFormatter* numberFormatter = [[NSNumberFormatter alloc] init];
    NSString* handleStr = [[command.arguments objectAtIndex:0] objectForKey:@"dbHandle"];
    NSNumber* handle = [numberFormatter numberFromString: handleStr];
    [self->$connectionLog log:@"Connection Bulk Inserted | Handle %@ | SQL - %@", [handle stringValue], sql];

    if (handle == nil) {
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Malformed handle"
            ]
            callbackId:command.callbackId
        ];
        return;
    }
    
    Database* db = [self->$databases objectForKey:handle];
    
    if (db == nil) {
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"Database Not Found. Did you open your database before calling bulkInsert?"
            ]
            callbackId:command.callbackId
        ];
        return;
    }
    else {
        [self.commandDelegate runInBackground:^{
            NSError* error;
            [db bulkRun:sql params:params error:&error];
            if (error) {
                [self.commandDelegate
                    sendPluginResult:[CDVPluginResult
                        resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
                    ]
                    callbackId:command.callbackId
                ];
                return;
            }
            [self.commandDelegate
                sendPluginResult:[CDVPluginResult
                    resultWithStatus:CDVCommandStatus_OK
                ]
                callbackId:command.callbackId
            ];
        }];
    }
}

- (void) backup:(CDVInvokedUrlCommand*) command {
    NSError* error;
    
    NSString* path = [[NSURL URLWithString: [command.arguments objectAtIndex:0]] path];
    NSString* backupPath = [[NSURL URLWithString: [command.arguments objectAtIndex:1]] path];

    NSFileManager* fs = [[NSFileManager alloc] init];

    if ([fs fileExistsAtPath: backupPath] && ![fs removeItemAtPath: backupPath error: &error]) {
        error = [[NSError alloc]
            initWithDomain: ERROR_DOMAIN
            code: ERROR_CODE_IO
            userInfo:@{
                NSLocalizedDescriptionKey: @"Could not remove old backup file.",
                NSUnderlyingErrorKey: error
            }
        ];
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
            ]
            callbackId:command.callbackId
        ];
        return;
    }
    
    if (![fs copyItemAtPath: path toPath: backupPath error: &error]) {
        error = [[NSError alloc]
            initWithDomain: ERROR_DOMAIN
            code: ERROR_CODE_IO
            userInfo:@{
                NSLocalizedDescriptionKey: @"Could not backup database.",
                NSUnderlyingErrorKey: error
            }
        ];
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
            ]
            callbackId:command.callbackId
        ];
        return;
   }

    [self.commandDelegate
        sendPluginResult:[CDVPluginResult
            resultWithStatus:CDVCommandStatus_OK
        ]
        callbackId:command.callbackId
    ];
}

- (void) restoreBackup:(CDVInvokedUrlCommand*) command {
    NSError* error;
    
    NSString* path = [[NSURL URLWithString: [command.arguments objectAtIndex:0]] path];
    NSString* backupPath = [[NSURL URLWithString: [command.arguments objectAtIndex:1]] path];
    NSString* tempPath = [NSString stringWithFormat:@"%@%@", backupPath, @"-temp"];
    NSFileManager* fs = [[NSFileManager alloc] init];

    // Clear file at tempURL if it exists
    if ([fs fileExistsAtPath: tempPath] && ![fs removeItemAtPath: tempPath error: &error]) {
        error = [[NSError alloc]
            initWithDomain: ERROR_DOMAIN
            code: ERROR_CODE_IO
            userInfo:@{
                NSLocalizedDescriptionKey: @"Could not clean old temp files.",
                NSUnderlyingErrorKey: error
            }
        ];
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
            ]
            callbackId:command.callbackId
        ];
        return;
    }

    // Copy path db to tempPath
    if (![fs copyItemAtPath: path toPath: tempPath error: &error]) {
        error = [[NSError alloc]
            initWithDomain: ERROR_DOMAIN
            code: ERROR_CODE_IO
            userInfo:@{
                NSLocalizedDescriptionKey: @"Could not store temp copy of database.",
                NSUnderlyingErrorKey: error
            }
        ];
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
            ]
            callbackId:command.callbackId
        ];
        return;
   }

    // Remove current database to make room for the restore.
    if ([fs fileExistsAtPath: path] && ![fs removeItemAtPath: path error: &error]) {
        error = [[NSError alloc]
            initWithDomain: ERROR_DOMAIN
            code: ERROR_CODE_IO
            userInfo:@{
                NSLocalizedDescriptionKey: @"Could not remove current database file.",
                NSUnderlyingErrorKey: error
            }
        ];
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
            ]
            callbackId:command.callbackId
        ];
        return;
    }

    // Restore Database
    if (![fs copyItemAtPath: backupPath toPath: path error: &error]) {
        NSString* userErr = @"Could not restore database.";
        NSError* fallbackErr;
        // Restore old db
        if (![fs copyItemAtPath: tempPath toPath: path error: &fallbackErr]) {
            // I dunno what to do here considering we are already in an error case.
            // I mean everything is royally screwed now.
            [userErr stringByAppendingString: @" Also failed to recover from error state."];
        }

        error = [[NSError alloc]
            initWithDomain: ERROR_DOMAIN
            code: ERROR_CODE_IO
            userInfo:@{
                NSLocalizedDescriptionKey: @"Could not restore database.",
                NSUnderlyingErrorKey: error
            }
        ];
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
            ]
            callbackId:command.callbackId
        ];
        return;
   }

    // Clear file at tempURL if it exists
    if ([fs fileExistsAtPath: tempPath] && ![fs removeItemAtPath: tempPath error: &error]) {
        error = [[NSError alloc]
            initWithDomain: ERROR_DOMAIN
            code: ERROR_CODE_IO
            userInfo:@{
                NSLocalizedDescriptionKey: @"Could not clean old temp files.",
                NSUnderlyingErrorKey: error
            }
        ];
        [self.commandDelegate
            sendPluginResult:[CDVPluginResult
                resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
            ]
            callbackId:command.callbackId
        ];
        return;
    }

    [self.commandDelegate
        sendPluginResult:[CDVPluginResult
            resultWithStatus:CDVCommandStatus_OK
        ]
        callbackId:command.callbackId
    ];
}

// - (void) getLogs:(CDVInvokedUrlCommand*) command {
//     NSError* error = nil;
//     NSArray* logs = [Logger getLogs:&error];
//     if (error) {
//         [self.commandDelegate
//             sendPluginResult:[CDVPluginResult
//                 resultWithStatus:CDVCommandStatus_ERROR messageAsDictionary:[ErrorUtility errorToDictionary:error]
//             ] callbackId:command.callbackId
//         ];
//         return;
//     }
//     [self.commandDelegate
//         sendPluginResult:[CDVPluginResult
//             resultWithStatus:CDVCommandStatus_OK messageAsArray: logs
//         ] callbackId:command.callbackId
//     ];
// }

@end
