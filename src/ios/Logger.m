#import <Foundation/Foundation.h>
#import "./Logger.h"
#import <OSLog/OSLog.h>
#import <os/log.h>


@implementation Logger {
    os_log_t $log;
}

    - (id _Nonnull) initWithSubSystem:(NSString*_Nonnull)subsystem category:(NSString*_Nonnull)category {
        $log = os_log_create([subsystem UTF8String], [category UTF8String]);
        return self;
    }

    -(void) log:(NSString*) format, ... __attribute__((format(NSString, 1, 2))) {
        va_list args;
        va_start(args, format);
        NSString* result = [[NSString alloc] initWithFormat:format arguments:args];
        va_end(args);
        os_log(self->$log, "%@", result);
    }

    // +(NSArray*) getLogs:(NSError**)error {
    //     OSLogStore* store = [OSLogStore storeWithScope: OSLogStoreCurrentProcessIdentifier error:error];
    //     OSLogEnumerator* enumer = [store entriesEnumeratorAndReturnError:error];
    //     NSArray* logs = enumer.allObjects;
    //     return logs;
    // }
@end
