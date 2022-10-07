package com.totalpave.cordova.sqlite;

public class Error {
    public static final String DOMAIN = "com.totalpave.cordova.sqlite.ErrorDomain";
    public static final String DETAILS_KEY = "details";
    public static final String QUERY_KEY = "query";

    public static final int BIND_PARAMETER_ERROR = 1;
    public static final int UNHANDLED_PARAMETER_TYPE = 2;
    public static final int UNSUPPORTED_COLUMN_TYPE = 3;
    public static final int DATABASE_NOT_FOUND = 4;
}
