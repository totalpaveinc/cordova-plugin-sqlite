
static NSString * const ERROR_DOMAIN = @"com.totalpave.cordova.sqlite.ErrorDomain";
static NSString * const ERROR_DETAILS_KEY = @"details";
static NSString * const ERROR_QUERY_KEY = @"query";

typedef NS_ENUM(short, TotalPaveSQLitePluginErrorCodes) {
    ERROR_CODE_BIND_PARAMETER_ERROR = 1,
    ERROR_CODE_UNHANDLED_PARAMETER_TYPE = 2,
    ERROR_CODE_UNSUPPORTED_COLUMN_TYPE = 3
};
