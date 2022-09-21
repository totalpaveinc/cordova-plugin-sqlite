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

import java.util.HashMap;
import java.util.Map;
import java.util.Iterator;

import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;

public class Database {
    private long $handle;

    public Database(String path, int openFlags) {
        $handle = Sqlite.open(path, openFlags);
    }

    public Long getHandle() {
        return $handle;
    }

    public void close() {
        Sqlite.close($handle);
    }

    public JSONArray run(String sql, JSONObject vars) throws JSONException {
        long statement = Sqlite.prepare($handle, sql);

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
                        throw new RuntimeException("Unhandled Complex Parameter Object");
                    }
                }
                else {
                    throw new RuntimeException("Unhandled Parameter Type");
                }
            }
        }

        JSONArray results = new JSONArray();
        int columnCount = 0;

        while (true) {
            int result = Sqlite.step(statement);

            if (result == Statement.ROW) {
                if (columnCount == 0) {
                    columnCount = Sqlite.columnCount(statement);
                }
                results.put($buildRowObject(statement, columnCount));
            }
            else if (result == Statement.DONE) {
                break;
            }
            else {
                // Error
            }
        }
        
        Sqlite.finalize(statement);

        return results;
    }

    private final JSONObject $buildRowObject(Long statement, int columnCount) throws JSONException {
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
