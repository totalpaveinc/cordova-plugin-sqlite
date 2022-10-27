
#import "Database.h"
#import <sqlite3.h>
#import <tp/sqlite/utilities.h>
#import <cmath>
#include <vector>

@implementation Database {
    sqlite3* $db;
}

- (id _Nonnull) initWithPath:(NSURL*_Nonnull) path openFlags:(int) openFlags error:(NSError*_Nullable*_Nonnull) error
{
    const char * cxxPath = [[path path] UTF8String];

    NSURL* filePath = [path URLByDeletingLastPathComponent];
    NSFileManager* fs = [[NSFileManager alloc] init];
    if (![fs fileExistsAtPath:[filePath path]]) {
        NSError* fsError;
        [fs createDirectoryAtURL:filePath withIntermediateDirectories:true attributes:nil error:&fsError];
        if (fsError) {
            *error = [[NSError alloc]
                initWithDomain:[NSString stringWithUTF8String:TP::sqlite::SQLITE_ERROR_DOMAIN]
                code:SQLITE_CANTOPEN
                userInfo:@{
                    NSLocalizedDescriptionKey: [NSString stringWithUTF8String: std::string("Could not make directories for path (" + std::string(cxxPath) + ")").c_str()],
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
                NSMutableString* newParamsString = [[NSMutableString alloc] init];
                for (NSUInteger vi = 0, vcount = [value count]; vi < vcount; ++vi) {
                    // :$ + key + "_" + vi
                    // The $ serves 2 purposes
                    // 1 - ensures paramName is different for array parameter key. E.X :ids will not match with :$ids_0.
                    // 2 - $ is a reserved character for parameter names and is not included in the parameter format enforcement of the plugin.
                    NSMutableString* paramName = [NSMutableString stringWithFormat:@"%@%@%@%lu", @"$", key, @"_", (unsigned long)vi];
                    // Add new param name with the value
                    [newParams setValue:value[vi] forKey:paramName];
                    [paramName insertString:@":" atIndex:0];
                    
                    // If this is not the last new param, add a comma
                    if (vi + 1 < vcount) {
                        [paramName appendString:@","];
                    }
                    [newParamsString appendString:paramName];
                }
            
                // Insert new params into the sql
                sql = [sql stringByReplacingCharactersInRange:NSMakeRange(range.location, 0) withString:newParamsString];


                // Search for duplicate param name of old param name. Note earlier we removed the first occurrence of old param name. The second occurrence, if any, is now the first occurrence.
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
        return nil;
    }

    [self $bindParams:statement params:params error: error];
    if (*error != nil) {
        sqlite3_finalize(statement);
        return nil;
    }
    
    NSMutableArray* results = [[NSMutableArray alloc] init];
    int columnCount = sqlite3_column_count(statement);
    
    while (true) {
        int status = sqlite3_step(statement);

        if (status == SQLITE_ROW) {
            [results addObject:[self $buildRowObject:statement columnCount: columnCount error: error]];
                if (*error != nil) {
                    sqlite3_finalize(statement);
                    return nil;
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
            return nil;
        }
    }
    
    sqlite3_finalize(statement);
    
    return [[NSArray alloc] initWithArray:results];
}

- (void) bulkRun:(NSString*_Nonnull) sql params:(NSArray*_Nullable) params error:(NSError*_Nullable*_Nonnull) error {
    sqlite3_stmt* statement;

    // Prepare VALUES string
    NSInteger rows = [params count];
    // It is invalid to have a variable number of columns, so assume the column count is the same across all rows is okay.
    NSInteger columns = [params[0] count];
    

    /*
        (columns * 2) - last comma + ( and )
        (?,?)
        (2 * 2) - 1 + 2
        4 + 1
        5
    */
    NSUInteger rowStringCapacity = (columns * 2) - 1 + 2;
    /*
        (rows * rowStringCapacity) + commas - last comma + "VALUES "
        VALUES (?,?),(?,?)
        (2 * 5) + 2 - 1 + 7
        10 + 8
        18
    */
    NSUInteger valuesStringCapacity = (rows * rowStringCapacity) + rows - 1 + 7;

    // Each row of values will look the exact same while they are unbounded. For that reason, let's prepare a string that we can re-use.
    NSMutableString* row = [NSMutableString stringWithCapacity:rowStringCapacity];
    [row appendString:@"("];
    for (NSInteger i = 0; i < columns; ++i) {
        [row appendString:@"?"];
        if ((i + 1) < columns) {
            [row appendString:@","];
        }
    }
    [row appendString:@")"];
    
    // Use our prepared re-useable row string to actually prepare the VALUES string.
    NSMutableString* values = [NSMutableString stringWithCapacity:valuesStringCapacity];
    [values appendString:@"VALUES "];
    for (NSInteger i = 0; i < rows; ++i) {
        [values appendString:row];
        if ((i + 1) < rows) {
            [values appendString:@","];
        }
    }
    
    // Replace :BulkInsertValue with VALUES string
    NSRange range = [sql rangeOfString: @":BulkInsertValue"];
    sql = [sql stringByReplacingCharactersInRange:range withString:values];
    
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
        return;
    }
    
    [self $bindBulkParams:statement params:params error: error];
    if (*error != nil) {
        sqlite3_finalize(statement);
        return;
    }
    
    int columnCount = sqlite3_column_count(statement);
    
    status = sqlite3_step(statement);
    if (status != SQLITE_DONE) {
        *error = [[NSError alloc]
            initWithDomain:[NSString stringWithUTF8String:TP::sqlite::SQLITE_ERROR_DOMAIN]
            code:status
            userInfo:@{
                NSLocalizedDescriptionKey: [NSString stringWithUTF8String:sqlite3_errstr(status)],
                ERROR_QUERY_KEY: sql
            }
        ];
    }
    sqlite3_finalize(statement);
}

- (void) close {
    sqlite3_close_v2(self->$db);
}

- (void) $bindBulkParams:(sqlite3_stmt*_Nonnull) statement params:(NSArray*_Nonnull) params error:(NSError*_Nullable*_Nonnull) error {
    // index is 1-base: https://www.sqlite.org/c3ref/bind_blob.html
    int index = 0;
    for (NSInteger x = 0, xlength = [params count]; x < xlength; ++x) {
        NSArray* row = params[x];
        for (NSInteger y = 0, ylength = [row count]; y < ylength; ++y) {
            index++;
            
            [self $bindParam:statement
                index:index
                value:row[y]
        parameterKeyForError:[NSString stringWithFormat:@"%@@%ld%@%ld%@", @"params[", (long)x, @"][", (long)y, @"]"]
                error:error
            ];
            if (*error != nil) {
                return;
            }
        }
    }
}

- (void) $bindParams:(sqlite3_stmt*_Nonnull) statement params:(NSDictionary*_Nullable) params error:(NSError*_Nullable*_Nonnull) error {
    if (![params isEqual:[NSNull null]]) {
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

            [self $bindParam:statement index:index value:value parameterKeyForError:key error:error];
            if (*error != nil) {
                return;
            }
        }
    }
}

- (void) $bindParam:(sqlite3_stmt*_Nonnull) statement index:(int) index value:(id _Nullable) value parameterKeyForError:(NSString*_Nonnull) parameterKeyForError error:(NSError*_Nullable*_Nonnull) error {
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
            std::vector<uint8_t> bytes(jByteArray.count);
            for (int i = 0, length = (int)jByteArray.count; i < length; ++i) {
                bytes[i] = [((NSNumber*)[jByteArray objectAtIndex:i]) intValue] & 0xFF;
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
                        "Unhandled Parameter Type for key \"" + std::string([parameterKeyForError UTF8String]) + "\""
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
            return nil;
        }
        [row setValue:value forKey:columnName];
    }
    
    return [[NSDictionary alloc] initWithDictionary:row];
}

@end
