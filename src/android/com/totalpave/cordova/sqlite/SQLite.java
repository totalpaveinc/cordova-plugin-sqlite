/*
   Copyright 2019 Total Pave Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

package com.totalpave.cordova.sqlite;

import com.totalpave.sqlite3.SqliteException;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

import java.security.InvalidParameterException;
import java.util.HashMap;
import java.net.URI;
import java.io.File;
import java.lang.NumberFormatException;

public class SQLite extends CordovaPlugin {
    public static final String LOG_TAG = "TP-SQLite";

    private HashMap<Long, Database> $databases;

    @Override
    protected void pluginInitialize() {
        $databases = new HashMap<Long, Database>();
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callback) throws JSONException, NumberFormatException {
        if (action.equals("open")) {
            String dbPath = args.getString(0);
            int openFlags = args.getInt(1);

            Long dbHandle;
            try {
                dbHandle = $openDatabase(dbPath, openFlags);
                JSONObject response = new JSONObject();
                response.put("dbHandle", Long.toString(dbHandle));
                callback.success(response);
            }
            catch (SqliteException ex) {
                callback.error(ex.toDictionary());
            }
            return true;
        }
        else if (action.equals("query")) {
            // The cordova API doesn't have a long version, but JSON objects does,
            // so to ensure int range safety when handling pointers, the dbHandle is wrapped in a JSON object.
            long dbHandle = Long.parseLong(args.getJSONObject(0).getString("dbHandle"));
            String sql = args.getString(1);
            JSONObject params = args.optJSONObject(2);

            try {
                JSONArray results = $query(dbHandle, sql, params);
                callback.success(results);
            }
            catch (SqliteException ex) {
                callback.error(ex.toDictionary());
            }
            return true;
        }
        else if (action.equals("close")) {
            long dbHandle = Long.parseLong(args.getJSONObject(0).getString("dbHandle"));
            Database db = $databases.get(dbHandle);
            if (db == null) {
                callback.success();
                return true;
            }

            db.close();
            $databases.remove(dbHandle);
            callback.success();
            return true;
        }

        return false;
    }
    
    private final Long $openDatabase(String path, int openFlags) throws SqliteException {
        Database db = new Database($parsePath(path), openFlags);
        $databases.put(db.getHandle(), db);
        return db.getHandle();
    }

    private final JSONArray $query(long dbHandle, String sql, JSONObject params) throws JSONException, SqliteException {
        Database db = $databases.get(dbHandle);

        if (db == null) {
            throw new SqliteException(Error.DOMAIN, "Database Not Found. Did you open your database before calling query?", Error.DATABASE_NOT_FOUND);
        }

        return db.run(sql, params);
    }

    private final File $parsePath(String path) {
        URI uri = URI.create(path);
        File file = new File(uri);
        return file;
    }
}
