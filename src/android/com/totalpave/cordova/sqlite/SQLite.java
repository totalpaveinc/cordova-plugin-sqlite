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
import com.totalpave.sqlite3.Sqlite;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

import android.util.Log;
import android.system.Os;
import android.system.OsConstants;

import java.io.FileNotFoundException;
import java.util.HashMap;
import java.net.URI;
import java.io.File;
import java.io.IOException;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.lang.NumberFormatException;

public class SQLite extends CordovaPlugin {
    public static final String LOG_TAG = "TP-SQLite";

    private HashMap<Long, Database> $databases;

    @Override
    protected void pluginInitialize() {
        $databases = new HashMap<Long, Database>();

        File cacheDir = this.cordova.getContext().getCacheDir();
        File sqliteTempDir = new File(cacheDir, "sqlite3");
        sqliteTempDir.mkdir();

        try {
            Sqlite.setTempDir(sqliteTempDir.getAbsolutePath());
        }
        catch(SqliteException ex) {
            Log.e(LOG_TAG, "Unable to set temporary directory for SQLite. Large queries may fail fatally.", ex);
        }
    }

    /**
     * Gets the ideal buffer size for processing streams of data.
     *
     * @return The page size of the device.
     */
    private int getPageSize() {
        // Get the page size of the device. Most devices will be 4096 (4kb)
        // Newer devices may be 16kb
        long ps = Os.sysconf(OsConstants._SC_PAGE_SIZE);

        // sysconf returns a long because it's a general purpose API
        // the expected value of a page size should not exceed an int,
        // but we guard it here to avoid integer overflow just in case
        if (ps > Short.MAX_VALUE) {
            ps = 4096;
        }

        return (int) ps;
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callback) throws JSONException, NumberFormatException {
        if (action.equals("open")) {
            String dbPath = args.getString(0);
            int openFlags = args.getInt(1);
            int busyTimeout = args.getInt(2);

            cordova.getThreadPool().execute(new Runnable() {
                public void run() {
                    try {
                        try {
                            long dbHandle = $openDatabase(dbPath, openFlags);
                            JSONObject response = new JSONObject();
                            response.put("dbHandle", Long.toString(dbHandle));
                            Sqlite.setBusyTimeout(dbHandle, busyTimeout);
                            callback.success(response);
                        }
                        catch (SqliteException ex) {
                            callback.error(ex.toDictionary());
                        }
                    }
                    catch (JSONException ex) {
                        callback.error(ex.getMessage());
                    }
                }
            });
            return true;
        }
        else if (action.equals("query")) {
            long dbHandle = Long.parseLong(args.getJSONObject(0).getString("dbHandle"));
            String sql = args.getString(1);
            JSONObject params = args.optJSONObject(2);
            Database db = $databases.get(dbHandle);
            if (db == null) {
                callback.error(new SqliteException(Error.DOMAIN, "Database Not Found. Did you open your database before calling query?", Error.DATABASE_NOT_FOUND).toDictionary());
                return true;
            }
            cordova.getThreadPool().execute(new Runnable() {
                public void run() {
                    try {
                        try {
                            callback.success(db.run(sql, params));
                        }
                        catch (SqliteException ex) {
                            callback.error(ex.toDictionary());
                        }
                    }
                    catch (JSONException ex) {
                        callback.error(ex.getMessage());
                    }
                }
            });
            return true;
        }
        else if (action.equals("bulkInsert")) {
            long dbHandle = Long.parseLong(args.getJSONObject(0).getString("dbHandle"));
            String sql = args.getString(1);
            JSONArray params = args.optJSONArray(2);
            Database db = $databases.get(dbHandle);

            if (db == null) {
                callback.error(new SqliteException(Error.DOMAIN, "Database Not Found. Did you open your database before calling bulkInsert?", Error.DATABASE_NOT_FOUND).toDictionary());
                return true;
            }
            cordova.getThreadPool().execute(new Runnable() {
                public void run() {
                    try {
                        try {
                            db.bulkRun(sql, params);
                            callback.success();
                        } catch (SqliteException ex) {
                            callback.error(ex.toDictionary());
                        }
                    }
                    catch (JSONException ex) {
                        callback.error(ex.getMessage());
                    }
                }
            });
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
        else if (action.equals("backup")) {
            String path = args.getString(0);
            String backupPath = args.getString(1);

            File source = $parsePath(path);
            File destination = $parsePath(backupPath);
            destination.delete(); // returns false if fails but we don't care.

            FileInputStream in;
            FileOutputStream out;

            try {
                in = new FileInputStream(source);
                out = new FileOutputStream(destination);
            }
            catch (FileNotFoundException ex) {
                callback.error(new SqliteException(Error.DOMAIN, ex.getMessage(), Error.IO_ERROR).toDictionary());
                return true;
            }
            try {
                // Transfer bytes from in to out
                byte[] buf = new byte[this.getPageSize() * 2];
                int len;
                while ((len = in.read(buf)) > 0) {
                    out.write(buf, 0, len);
                }
            }
            catch (IOException ex) {
                try {
                    out.close();
                    in.close();
                }
                catch (IOException iex) {
                    Log.e(LOG_TAG, iex.getMessage());
                }
                callback.error(new SqliteException(Error.DOMAIN, ex.getMessage(), Error.IO_ERROR).toDictionary());
                return true;
            }

            callback.success();
            return true;
        }
        else if (action.equals("restoreBackup")) {
            String path = args.getString(0);
            String backupPath = args.getString(1);

            File tempdestination = $parsePath(path + "-temp");
            File source = $parsePath(backupPath);
            File destination = $parsePath(path);

            String userErr = "Could not restore database.";

            // Store existing database in case of failure.
            if (!destination.renameTo(tempdestination)) {
                callback.error(new SqliteException(Error.DOMAIN, "Could not rename existing database.", Error.IO_ERROR).toDictionary());
                return true;
            }

            // Restore db
            if (!source.renameTo(destination)) {
                if (!tempdestination.renameTo(destination)) {
                    userErr += " Also failed to recover from error state.";
                }
                callback.error(new SqliteException(Error.DOMAIN, userErr, Error.IO_ERROR).toDictionary());
                return true;
            }

            tempdestination.delete();
            source.delete();

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

    private final File $parsePath(String path) {
        URI uri = URI.create(path);
        File file = new File(uri);
        return file;
    }
}
