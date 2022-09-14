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

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.LOG;
import org.json.JSONArray;
import org.json.JSONException;
import java.util.HashMap;

public class SQLite extends CordovaPlugin {
    public static final String LOG_TAG = "TP-SQLite";

    private HashMap<Long, Database> $databases;

    @Override
    protected void pluginInitialize() {
        $databases = new HashMap<>();
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callback) throws JSONException {
        // TODO: Handle exceptions...?
        if (action.equals("open")) {
            String dbPath = args.getString(0);
            int openFlags = args.getInt(1);

            Long dbHandle = $openDatabase(dbPath, openFlags);
            callback.success(dbHandle);
            return true;
        }
        else if (action.equals("query")) {
            long dbHandle = args.getInt(0);
            String sql = args.getString(1);
            JSONObject params = args.optJSONObject(2);

            JSONArray results = $query(dbHandle, sql, params);
            callback.success(results);
            return true;
        }
        else if (action.equals("close")) {
            long dbHandle = args.getInt(0);
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
    
    private final Long $openDatabase(String path, int openFlags) {
        Database db = new Database(path, openFlags);
        $databases.put(db.getHandle(), db);
        return db.getHandle();
    }

    private final JSONArray $query(long dbHandle, String sql, JSONObject params) throws JSONException {
        Database db = $databases.get(dbHandle);

        if (db == null) {
            // throw error;
            return new JSONArray();
        }

        return db.run(sql, params);
    }
}
