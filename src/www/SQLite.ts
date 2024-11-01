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

import {Database} from './Database';
import {IError} from './IError';
import {SQLiteInteger} from './SQLiteTypes';

enum OpenFlags {
    READ_ONLY       = 0x00000001,
    READ_WRITE      = 0x00000002,
    CREATE          = 0x00000004,
    URI             = 0x00000040,
    MEMORY          = 0x00000080,
    NO_MUTEX        = 0x00008000,
    FULL_MUTEX      = 0x00010000,
    SHARED_CACHE    = 0x00020000,
    PRIVATE_CACHE   = 0x00040000,
    NO_FOLLOW       = 0x01000000
};

export const SERVICE_NAME: string = "TPSQLite";

const DEFAULT_BUSY_TIMEOUT: number = 60000; // 60 seconds

export class SQLite {
    private static async $exec<TArgs extends Array<any> = Array<any>, TResponse = any>(method: string, vargs: TArgs): Promise<TResponse> {
        return new Promise<TResponse>((resolve, reject) => {
            cordova.exec((response) => {
                resolve(response);
            }, (error: IError) => {
                reject(error);
            }, SERVICE_NAME, method, vargs);
        });
    }

    public static async open(path: string, writeAccess: boolean, busyTimeout: SQLiteInteger = DEFAULT_BUSY_TIMEOUT): Promise<Database> {
        if (path.indexOf("file://") !== 0) {
            throw new Error("Database path must start with file://");
        }

        let dbHandle: string = (
            await this.$exec<
                [string, number, SQLiteInteger],
                {dbHandle: string}
            >(
                'open',
                [
                    path,
                    writeAccess ? OpenFlags.CREATE | OpenFlags.READ_WRITE : OpenFlags.READ_ONLY,
                    busyTimeout
                ]
            )
        ).dbHandle;
        return new Database(dbHandle);
    }

    public static async close(db: Database): Promise<void> {
        await this.$exec<[{dbHandle: string}], void>('close', [ { dbHandle: db.getHandle() } ]);
        db.__close();
    }

    /**
     * 
     * Note, this API is unsafe to use while the db is being actively used.
     * 
     * @param path 
     * @param backupName 
     */
    public static async backup(path: string, backupPath: string): Promise<void> {
        await this.$exec<[path: string, backupPath: string], void>('backup', [ path, backupPath ]);
    }

    /**
     * 
     * Note, this API is unsafe to use while the db is being actively used.
     * Close all active databases prior to restoring and re-open them after restoring.
     * 
     * @param path 
     * @param backupName 
     */
    public static async restoreBackup(path: string, backupPath: string): Promise<void> {
        await this.$exec<[path: string, backupPath: string], void>('restoreBackup', [ path, backupPath ]);
    }

    // Incomplete API
    // public static async getLogs(): Promise<Array<String>> {
    //     return await this.$exec('getLogs', []);
    // }
};
