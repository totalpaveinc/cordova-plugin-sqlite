
#import "./Error.h"

@interface Database : NSObject
    - (id _Nonnull) initWithPath:(NSString*_Nonnull) path openFlags:(int) openFlags error:(NSError*_Nullable*_Nonnull) error;
    - (nullable NSNumber*) getHandle;
    - (NSArray*_Nullable) run:(NSString*_Nonnull) sql params:(NSDictionary*_Nullable) params error:(NSError*_Nullable*_Nonnull) error;
    - (void) close;
@end
