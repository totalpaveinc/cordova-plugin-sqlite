
static NSString * const SUBSYSTEM = @"com.totalpave.cordova-plugin-sqlite";
static NSString * const CONNECTION_LOG_CATEGORY = @"ConnectionLog";

@interface Logger : NSObject
    - (id _Nonnull) initWithSubSystem:(NSString*_Nonnull)subsystem category:(NSString*_Nonnull)category;
    - (void) log:(NSString*) format, ... __attribute__((format(NSString, 1, 2)));
@end
