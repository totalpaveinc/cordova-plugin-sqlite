
#import "SQLite.h"
#import "Database.h"
#import "ErrorUtility.h"
#import "./Error.h"
#import <sqlite3.h>

@implementation SQLite {
    NSMutableDictionary* $databases;
}

- (void)pluginInitialize
{
    self->$databases = [[NSMutableDictionary alloc] init];
    
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

-(void)open:(CDVInvokedUrlCommand *)command
{
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
            NSMutableDictionary* response = [[NSMutableDictionary alloc] init];
            [response setObject:handle forKey:@"dbHandle"];
            
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

-(void)query:(CDVInvokedUrlCommand *)command
{
    NSString* sql = [command.arguments objectAtIndex:1];
    NSDictionary* params = [command.arguments objectAtIndex:2];

    Database* db = [self->$databases objectForKey:[[command.arguments objectAtIndex:0] objectForKey:@"dbHandle"]];
    if ([db isEqual:[NSNull null]]) {
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

-(void)close:(CDVInvokedUrlCommand *)command
{
    Database* db = [self->$databases objectForKey:[[command.arguments objectAtIndex:0] objectForKey:@"dbHandle"]];
    if (![db isEqual:[NSNull null]]) {
        [db close];
        [self->$databases removeObjectForKey:[db getHandle]];
    }
    [self.commandDelegate
        sendPluginResult:[CDVPluginResult resultWithStatus:CDVCommandStatus_OK]
        callbackId:command.callbackId
    ];
}

-(void)bulkInsert:(CDVInvokedUrlCommand *)command
{
    NSString* sql = [command.arguments objectAtIndex:1];
    NSArray* params = [command.arguments objectAtIndex:2];
    Database* db = [self->$databases objectForKey:[[command.arguments objectAtIndex:0] objectForKey:@"dbHandle"]];
    
    if ([db isEqual:[NSNull null]]) {
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

@end
