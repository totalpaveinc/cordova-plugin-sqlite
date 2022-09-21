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

export class SQLite {
    private static async $exec<TArgs extends Array<any> = Array<any>, TResponse = any>(method: string, vargs: TArgs): Promise<TResponse> {
        return new Promise<TResponse>((resolve, reject) => {
            cordova.exec((response) => {
                resolve(response);
            }, (error: any) => {
                reject(error);
            }, SERVICE_NAME, method, vargs);
        });
    }

    public static async open(path: string, writeAccess: boolean): Promise<Database> {
        let dbHandle: number = await this.$exec<[string, number], number>('open', [path, writeAccess ? OpenFlags.CREATE | OpenFlags.READ_WRITE : OpenFlags.READ_ONLY]);
        return new Database(dbHandle);
    }

    public static async close(db: Database): Promise<void> {
        await this.$exec<[number], void>('close', [db.getHandle()]);
        db.__close();
    }
};
