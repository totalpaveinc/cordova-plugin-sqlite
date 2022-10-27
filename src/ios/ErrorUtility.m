
#import "Error.h"
#import "ErrorUtility.h"

@implementation ErrorUtility
    +(NSDictionary*)errorToDictionary:(NSError*)error {
        NSString* message = error.userInfo[NSLocalizedDescriptionKey];
        NSError*_Nullable underlyingError = error.userInfo[NSUnderlyingErrorKey];
        NSDictionary*_Nullable cause = [NSNull null];
        if (![underlyingError isEqual: [NSNull null]] && underlyingError != nil) {
            cause = [ErrorUtility errorToDictionary: underlyingError];
        }
        return @{
            @"code": [NSNumber numberWithLong:error.code],
            @"message": message == nil ? [NSNull null] : message,
            @"cause": cause == nil ? [NSNull null] : cause,
            @"name": error.domain,
            ERROR_DETAILS_KEY: error.userInfo[ERROR_DETAILS_KEY] == nil ? [NSNull null] : error.userInfo[ERROR_DETAILS_KEY]
        };
    }
@end
