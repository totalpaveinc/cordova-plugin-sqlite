
#import "Database.h"
#import <sqlite3.h>
#import <tp/sqlite/utilities.h>
#import <cmath>
#include <vector>

@implementation Database {
    sqlite3* $db;
}

- (id _Nonnull) initWithPath:(NSString*_Nonnull) path openFlags:(int) openFlags error:(NSError*_Nullable*_Nonnull) error
{
    const char * cxxPath = [path UTF8String];

    NSURL* filePath = [[NSURL fileURLWithPath:path] URLByDeletingLastPathComponent];
    NSFileManager* fs = [[NSFileManager alloc] init];
    if (![fs fileExistsAtPath:[filePath path]]) {
        NSError* fsError;
        [fs createDirectoryAtURL:filePath withIntermediateDirectories:true attributes:NULL error:&fsError];
        if (fsError) {
            error = [[NSError alloc]
                initWithDomain:[NSString stringWithUTF8String:TP::sqlite::SQLITE_ERROR_DOMAIN]
                code:SQLITE_CANTOPEN
                userInfo:@{
                    NSLocalizedDescriptionKey: @"Could not make directories for path (" + std::string(cxxPath) + ")",
                    NSUnderlyingErrorKey: fsError
                }
            ];
            return self;
        }
    }

    int status = sqlite3_open_v2(cxxPath, &(self->$db), openFlags, nullptr);
    if (status != SQLITE_OK) {
        *error = [[NSError alloc]
            initWithDomain:[NSString stringWithUTF8String:TP::sqlite::SQLITE_ERROR_DOMAIN]
            code:status
            userInfo:@{
                NSLocalizedDescriptionKey: [NSString
                    stringWithUTF8String:(
                        std::string(sqlite3_errstr(status)) + " (" + std::string(cxxPath) + ")"
                    ).c_str()
                ]
            }
        ];
        return self;
    }

    return self;
}

- (nullable NSNumber*) getHandle {
    return [[NSNumber alloc] initWithLong:(long)self->$db];
}

- (NSArray*_Nullable) run:(NSString*_Nonnull) sql params:(NSDictionary*_Nullable) params error:(NSError*_Nullable*_Nonnull) error {
    sqlite3_stmt* statement;
    
    NSMutableArray* arrayKeys = [[NSMutableArray alloc] init];
    if (![params isEqual:[NSNull null]]) {
        NSArray* keys = [params allKeys];
        for (NSUInteger i = 0, count = [keys count]; i < count; ++i) {
            if ([[params objectForKey:keys[i]] isKindOfClass:[NSArray class]]) {
                [arrayKeys addObject:keys[i]];
            }
        }
    }
    
    if ([arrayKeys count] != 0) {
        NSMutableDictionary* newParams = [NSMutableDictionary dictionaryWithDictionary:params];
        for (NSUInteger i = 0, count = [arrayKeys count]; i < count; ++i) {
            NSString* key = arrayKeys[i];
            NSString* colonKey = [@":" stringByAppendingString:key];
            NSArray* value = [params objectForKey:key];
            // The range that respresents the old parameter name.
            NSRange range = [sql rangeOfString: colonKey];
            
            // Remove old param name
            [newParams removeObjectForKey:key];
            
            while (range.location != NSNotFound) {
                // Remove old param name.
                sql = [sql stringByReplacingCharactersInRange:range withString:@""];
                NSString* newParams = @"";
                for (NSUInteger vi = 0, vcount = [value count]; vi < vcount; ++vi) {
                    // colonKey + "_" + vi
                    NSString* paramName = [[colonKey stringByAppendingString:@"_"] stringByAppendingString:[@(vi) stringValue]];
                    // Add new param name with the value
                    [newParams setValue:value[vi] forKey:paramName];
                    // If this is not the last new param, add a comma
                    if (vi + 1 < vcount) {
                        paramName = [paramName stringByAppendingString:@","];
                    }
                    newParams = [newParams stringByAppendingString:paramName];
                }
            
                // Insert new params into the sql
                sql = [sql stringByReplacingCharactersInRange:NSMakeRange(range.location, 0) withString:newParams];

                // Search for duplicate param name of old param name. Note earlier we removed the first occurrence of old param name.
                // So a duplicate will be the new first occurrence.
                range = [sql rangeOfString: colonKey];
            }
        }
        params = newParams;
    }
    
    const char * cxxSql = [sql UTF8String];
    int status = sqlite3_prepare_v2(self->$db, cxxSql, (int)strlen(cxxSql), &statement, 0);
    if (status != SQLITE_OK) {
        *error = [[NSError alloc]
            initWithDomain:[NSString stringWithUTF8String:TP::sqlite::SQLITE_ERROR_DOMAIN]
            code:status
            userInfo:@{
                NSLocalizedDescriptionKey: [NSString stringWithUTF8String:sqlite3_errstr(status)],
                ERROR_QUERY_KEY: sql
            }
        ];
        sqlite3_finalize(statement);
        return NULL;
    }

    [self $bindParams:statement params:params error: error];
    if (*error != NULL) {
        sqlite3_finalize(statement);
        return NULL;
    }
    
    NSMutableArray* results = [[NSMutableArray alloc] init];
    int columnCount = sqlite3_column_count(statement);
    
    while (true) {
        int status = sqlite3_step(statement);

        if (status == SQLITE_ROW) {
            [results addObject:[self $buildRowObject:statement columnCount: columnCount error: error]];
                if (*error != NULL) {
                    sqlite3_finalize(statement);
                    return NULL;
                }
        }
        else if (status == SQLITE_DONE) {
            break;
        }
        else {
            *error = [[NSError alloc]
                initWithDomain:[NSString stringWithUTF8String:TP::sqlite::SQLITE_ERROR_DOMAIN]
                code:status
                userInfo:@{
                    NSLocalizedDescriptionKey: [NSString stringWithUTF8String:sqlite3_errstr(status)],
                    ERROR_QUERY_KEY: sql
                }
            ];
            sqlite3_finalize(statement);
            return NULL;
        }
    }
    
    sqlite3_finalize(statement);
    
    return [[NSArray alloc] initWithArray:results];
}

- (void) close {
    sqlite3_close_v2(self->$db);
}

- (void) $bindParams:(sqlite3_stmt*_Nonnull) statement params:(NSDictionary*_Nullable) params error:(NSError*_Nullable*_Nonnull) error {
    if ([params isEqual:[NSNull null]]) {
        for (NSString* key in params) {
            id value = [params valueForKey:key];
            int index = TP::sqlite::lookupVariableIndex(statement, [key UTF8String]);
            if (index == 0) {
                *error = [[NSError alloc]
                    initWithDomain:[NSString stringWithUTF8String:TP::sqlite::TOTALPAVE_SQLITE_ERROR_DOMAIN]
                    code:TP::sqlite::ERROR_CODE_BIND_PARAMETER_ERROR
                    userInfo:@{
                        NSLocalizedDescriptionKey: [NSString
                            stringWithUTF8String:(
                                "Could not bind parameter \"" + std::string([key UTF8String]) + "\""
                            ).c_str()
                        ],
                        ERROR_QUERY_KEY: [NSString stringWithUTF8String: sqlite3_sql(statement)]
                    }
                ];
                return;
            }

            int status;

            if ([value isEqual:[NSNull null]]) {
                status = sqlite3_bind_null(statement, index);
            }
            else if ([value isKindOfClass:[NSString class]]) {
                const char * val = [value UTF8String];
                status = sqlite3_bind_text(statement, index, val, (int)strlen(val), SQLITE_TRANSIENT);
            }
            else if ([value isKindOfClass:[NSNumber class]]) {
                if (fmod([value doubleValue], 1) == 0.0) {
                    status = sqlite3_bind_int(statement, index, [value intValue]);
                }
                else {
                    status = sqlite3_bind_double(statement, index, [value doubleValue]);
                }
            }
            else if ([value isKindOfClass:[NSDictionary class]]) {
                NSDictionary* val = value;
                NSString* objType = [val objectForKey:@"type"];
                if ([objType isEqual: @"bytearray"]) {
                    NSArray* jByteArray = [val objectForKey:@"value"];
                    std::vector<uint8_t> bytes(jByteArray.count - 1);
                    for (int i = 0, length = (int)jByteArray.count; i < length; ++i) {
                        bytes[i] = [[jByteArray objectAtIndex:i] intValue] & 0xFF;
                    }
                    status = sqlite3_bind_blob(statement, index, &bytes, (int)jByteArray.count - 1, SQLITE_TRANSIENT);
                }
                else {
                    *error = [[NSError alloc]
                        initWithDomain:ERROR_DOMAIN
                        code:ERROR_CODE_UNHANDLED_PARAMETER_TYPE
                        userInfo:@{
                            NSLocalizedDescriptionKey: [NSString
                                stringWithUTF8String:(
                                    "Unhandled Complex Parameter Object for type \"" + std::string([objType UTF8String]) + "\""
                                ).c_str()
                            ],
                            ERROR_QUERY_KEY: [NSString stringWithUTF8String: sqlite3_sql(statement)]
                        }
                    ];
                    return;
                }
            }
            else {
                *error = [[NSError alloc]
                    initWithDomain:ERROR_DOMAIN
                    code:ERROR_CODE_UNHANDLED_PARAMETER_TYPE
                    userInfo:@{
                        NSLocalizedDescriptionKey: [NSString
                            stringWithUTF8String:(
                                "Unhandled Parameter Type for key \"" + std::string([key UTF8String]) + "\""
                            ).c_str()
                        ],
                        ERROR_QUERY_KEY: [NSString stringWithUTF8String: sqlite3_sql(statement)]
                    }
                ];
                return;
            }

            if (status != SQLITE_OK) {
                *error = [[NSError alloc]
                    initWithDomain:[NSString stringWithUTF8String:TP::sqlite::SQLITE_ERROR_DOMAIN]
                    code: status
                    userInfo:@{
                        NSLocalizedDescriptionKey: [NSString stringWithUTF8String:sqlite3_errstr(status)],
                        ERROR_QUERY_KEY: [NSString stringWithUTF8String:sqlite3_sql(statement)]
                    }
                ];
                return;
            }
        }
    }
}

- (NSDictionary*_Nullable) $buildRowObject:(sqlite3_stmt*_Nonnull) statement columnCount:(int) columnCount error:(NSError*_Nullable*_Nonnull) error {
    NSMutableDictionary* row = [[NSMutableDictionary alloc] initWithCapacity:columnCount];
    
    for (int i = 0; i < columnCount; i++) {
        int columnType = sqlite3_column_type(statement, i);
        NSString* columnName = [NSString stringWithUTF8String: sqlite3_column_name(statement, i)];
        id value;
        if (columnType == SQLITE_INTEGER) {
            value = [NSNumber numberWithInt: sqlite3_column_int(statement, i)];
        }
        else if (columnType == SQLITE_FLOAT) {
            value = [NSNumber numberWithDouble: sqlite3_column_double(statement, i)];
        }
        else if (columnType == SQLITE_TEXT) {
            value = [NSString stringWithUTF8String: (const char *)sqlite3_column_text(statement, i)];
        }
        else if (columnType == SQLITE_BLOB) {
            value = [[NSArray alloc] init];
            const unsigned char * bytes = (unsigned char *)sqlite3_column_blob(statement, i);
            int length = sqlite3_column_bytes(statement, i);
            for (int i = 0; i < length; i++) {
                [value addObject:[NSNumber numberWithInt: bytes[i]]];
            }
        }
        else if (columnType == SQLITE_NULL) {
            value = [NSNull null];
        }
        else {
            *error = [[NSError alloc]
                initWithDomain:ERROR_DOMAIN
                code:ERROR_CODE_UNSUPPORTED_COLUMN_TYPE
                userInfo:@{
                    NSLocalizedDescriptionKey: [NSString
                        stringWithUTF8String:(
                            "Unhandled Column Type \"" + std::to_string(columnType) + "\""
                        ).c_str()
                    ],
                    ERROR_QUERY_KEY: [NSString stringWithUTF8String: sqlite3_sql(statement)]
                }
            ];
            return NULL;
        }
        [row setValue:value forKey:columnName];
    }
    
    return [[NSDictionary alloc] initWithDictionary:row];
}

@end
