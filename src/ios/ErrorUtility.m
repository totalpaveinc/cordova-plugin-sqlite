
#import "Error.h";
#import "ErrorUtility.h"

@implementation ErrorUtility
    +(NSDictionary*)errorToDictionary:(NSError*)error {
        NSString* message = error.userInfo[NSLocalizedDescriptionKey];
        NSError*_Nullable underlyingError = error.userInfo[NSUnderlyingErrorKey];
        NSDictionary* cause = [NSNull null];
        if (![underlyingError isEqual: [NSNull null]]) {
            cause = [ErrorUtility errorToDictionary: underlyingError];
        }
        return @{
            @"code": [NSNumber numberWithLong:error.code],
            @"message": message == NULL ? [NSNull null] : message,
            @"cause": cause == NULL ? [NSNull null] : cause,
            @"name": error.domain,
            ERROR_DETAILS_KEY: error.userInfo[ERROR_DETAILS_KEY] == nil ? [NSNull null] : error.userInfo[ERROR_DETAILS_KEY]
        };
    }
@end
