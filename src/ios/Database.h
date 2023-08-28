
#import "./Error.h"
#import <Foundation/Foundation.h>

@interface Database : NSObject
    - (id _Nonnull) initWithPath:(NSURL*_Nonnull) path openFlags:(int) openFlags busyTimeout:(int) busyTimeout error:(NSError*_Nullable*_Nonnull) error;
    - (nullable NSNumber*) getHandle;
    - (NSArray*_Nullable) run:(NSString*_Nonnull) sql params:(NSDictionary*_Nullable) params error:(NSError*_Nullable*_Nonnull) error;
    - (void) bulkRun:(NSString*_Nonnull) sql params:(NSArray*_Nullable) params error:(NSError*_Nullable*_Nonnull) error;
    - (void) close;
@end
