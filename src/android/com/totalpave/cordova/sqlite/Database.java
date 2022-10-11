/*
   Copyright 2022 Total Pave Inc.

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

import com.totalpave.sqlite3.Sqlite;
import com.totalpave.sqlite3.ColumnType;
import com.totalpave.sqlite3.Statement;
import com.totalpave.sqlite3.SqliteException;

import java.io.File;
import java.util.ArrayList;
import java.util.Iterator;

import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;

public class Database {
    private long $handle;

    public Database(File fpath, int openFlags) throws SqliteException {
        File directory = fpath.getParentFile();
        if (!directory) {
            directory.mkdirs();
        }
        $handle = Sqlite.open(fpath.getAbsolutePath(), openFlags);
    }

    public Long getHandle() {
        return $handle;
    }

    public void close() {
        Sqlite.close($handle);
    }

    public JSONArray run(String sql, JSONObject vars) throws JSONException, SqliteException {
        ArrayList<String> arrayKeys = new ArrayList<>();
        if (vars != null) {
            Iterator<String> keys = vars.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                if (vars.get(key) instanceof JSONArray) {
                    arrayKeys.add(key);
                }
            }
        }

        for (int i = 0, length = arrayKeys.size(); i < length; ++i) {
            String key = arrayKeys.get(i);
            String colonKey = ":" + key;
            JSONArray value = vars.getJSONArray(key);
            // The index of the old param name
            int paramIndex = sql.indexOf(colonKey);

            // Remove old param name
            vars.remove(key);

            while (paramIndex != -1) {
                // Remove old param name
                sql = sql.replaceFirst(colonKey, "");
                String newParams = "";
                for (int vi = 0, vlength = value.length(); vi < vlength; ++vi) {
                    String paramName = colonKey + "_" + Integer.toString(vi);
                    // Add new param name with the value
                    vars.put(paramName, value.get(vi));
                    newParams += paramName + (vi + 1 < vlength ? "," : "");
                }

                // Insert new params into the sql
                sql = sql.substring(0, paramIndex - 1) + newParams + sql.substring(paramIndex);

                // Search for duplicate param name of old param name. Note earlier we removed the first occurrence of old param name.
                // So a duplicate will be the new first occurrence.
                paramIndex = sql.indexOf(colonKey);
            }
        }

        long statement;
        try {
            statement = Sqlite.prepare($handle, sql);
        }
        catch (SqliteException ex) {
            JSONObject details = new JSONObject();
            details.put(Error.QUERY_KEY, sql);
            ex.setDetails(details);
            throw ex;
        }

        // We create a new try-catch here because it's unsafe to call finalize on a failed statement.
        try {
            this.$bindVars(statement, vars);

            JSONArray results = new JSONArray();
            int columnCount = Sqlite.columnCount(statement);

            while (true) {
                int result = Sqlite.step(statement);

                if (result == Statement.ROW) {
                    results.put($buildRowObject(statement, columnCount));
                } else {
                    break;
                }
            }

            Sqlite.finalize(statement);

            return results;
        }
        catch (SqliteException ex) {
            Sqlite.finalize(statement);
            JSONObject details = new JSONObject();
            details.put(Error.QUERY_KEY, sql);
            ex.setDetails(details);
            throw ex;
        }
    }

    private final void $bindVars(long statement, JSONObject vars) throws JSONException, SqliteException {
        if (vars != null) {
            Iterator<String> keys = vars.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = vars.get(key);

                if (value == JSONObject.NULL) {
                    Sqlite.bindNull(statement, key);
                }
                else if (value instanceof String) {
                    Sqlite.bindString(statement, key, (String)value);
                }
                else if (value instanceof Integer) {
                    Sqlite.bindInt(statement, key, (Integer)value);
                }
                else if (value instanceof Double) {
                    Sqlite.bindDouble(statement, key, (Double)value);
                }
                else if (value instanceof JSONObject) {
                    // This is a complex object, such as an object representing  binary data.
                    JSONObject v = (JSONObject)value;
                    String objType = v.getString("type");
                    if (objType.equals("bytearray")) {
                        JSONArray jByteArray = v.getJSONArray("value");
                        byte[] bytes = new byte[jByteArray.length()];
                        for (int i = 0; i < jByteArray.length(); i++) {
                            // The 0xFF mask is to trim off any value that is larger than 8 bits.
                            // The expected array should be a int8 array.
                            bytes[i] = (byte)(((int)jByteArray.get(i)) & 0xFF);
                        }

                        Sqlite.bindBlob(statement, key, bytes);
                    }
                    else {
                        throw new SqliteException(Error.DOMAIN, "Unhandled Complex Parameter Object for type \"" + objType + "\"", Error.UNHANDLED_PARAMETER_TYPE);
                    }
                }
                else {
                    throw new SqliteException(Error.DOMAIN, "Unhandled Parameter Type for key \"" + key + "\"", Error.UNHANDLED_PARAMETER_TYPE);
                }
            }
        }
    }

    private final JSONObject $buildRowObject(Long statement, int columnCount) throws JSONException, SqliteException {
        JSONObject row = new JSONObject();

        for (int i = 0; i < columnCount; i++) {
            int columnType = Sqlite.columnType(statement, i);
            String columnName = Sqlite.columnName(statement, i);
            switch (columnType) {
                case ColumnType.INTEGER:
                    row.put(columnName, Sqlite.getInt(statement, i));
                    break;
                case ColumnType.FLOAT:
                    row.put(columnName, Sqlite.getDouble(statement, i));
                    break;
                case ColumnType.TEXT:
                    row.put(columnName, Sqlite.getString(statement, i));
                    break;
                case ColumnType.BLOB:
                    row.put(columnName, $parseByteArray(Sqlite.getBlob(statement, i)));
                    break;
                case ColumnType.NULL:
                    row.put(columnName, JSONObject.NULL);
                    break;
                default:
                    throw new SqliteException(Error.DOMAIN, "Unhandled Column Type \"" + Integer.toString(columnType) + "\"", Error.UNSUPPORTED_COLUMN_TYPE);
            }
        }

        return row;
    }

    private final JSONArray $parseByteArray(byte[] bytes) throws JSONException {
        JSONArray blob = new JSONArray();

        for (int i = 0; i < bytes.length; i++) {
            blob.put(bytes[i]);
        }

        return blob;
    }
}
