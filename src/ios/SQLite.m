
#import "SQLite.h"
#import "Database.h"
#import "ErrorUtility.h"
#import "./Error.h"

@implementation SQLite {
    NSMutableDictionary* $databases;
}

- (void)pluginInitialize
{
    self->$databases = [[NSMutableDictionary alloc] init];
}

-(void)open:(CDVInvokedUrlCommand *)command
{
    [self.commandDelegate runInBackground:^{
        NSError* error;
        Database *db = [[Database alloc]
            initWithPath: [NSURL URLWithString: [command.arguments objectAtIndex:0]]
            openFlags: [[command.arguments objectAtIndex:1] intValue]
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
