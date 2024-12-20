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

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready

import {
    SQLite,
    Database,
    RawQuery,
    BulkInsertQuery,
    Query,
    StartTransactionQuery,
    CommitTransactionQuery,
    SQLiteParamValueConverter,
    SQLiteInteger,
    SQLiteText,
    SQLiteDouble,
    SQLiteBlob,
    SQLiteNull,
    SQLiteParams
} from '@totalpave/cordova-plugin-sqlite';

interface IInsertPersonQueryParams {
    id: SQLiteInteger;
    name: SQLiteText;
    height: SQLiteDouble;
    data?: Blob | SQLiteNull;
}

class InsertPersonQuery extends Query<IInsertPersonQueryParams, void> {
    public getQuery() {
        return `
            INSERT INTO test VALUES (
                :id,
                :name,
                :height,
                :data
            )
        `;
    }

    protected async _getParameters(params: IInsertPersonQueryParams): Promise<SQLiteParams> {
        return {
            id: params.id,
            name: params.name,
            height: params.height,
            data: params.data ? (await SQLiteParamValueConverter.blobToSQLiteBlob(params.data)) : null
        };
    }
}


type TBulkInsertPersonQueryParams = Array<[
    id: SQLiteInteger,
    name: SQLiteText,
    height: SQLiteDouble,
    data: SQLiteBlob | SQLiteNull
]>;

class BulkInsertPersonQuery extends BulkInsertQuery<TBulkInsertPersonQueryParams> {
    protected _getTable(): string {
        return "test";
    }

    protected _getColumns(): Array<string> {
        return [
            "id",
            "name",
            "height",
            "data"
        ];
    }

    protected _getOnConflict(): string {
        return `
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name,
                height = excluded.height,
                data = excluded.data
        `;
    }
}

class BulkInsertColumnEscapeQuery extends BulkInsertQuery<TBulkInsertPersonQueryParams> {
    protected _getTable(): string {
        return "test";
    }

    protected _getColumns(): Array<string> {
        return [
            "id",
            "`name`",
            "test.height",
            "`test`.`data`"
        ];
    }

    protected _getOnConflict(): string {
        return `
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name,
                height = excluded.height,
                data = excluded.data
        `;
    }
}

document.addEventListener('deviceready', onDeviceReady, false);

let db: Database;

async function prepareTestDB() {
    db = await SQLite.open(cordova.file.dataDirectory + 'test.db', true);
    await new RawQuery(`
        CREATE TABLE IF NOT EXISTS test (
            id INTEGER NOT NULL PRIMARY KEY,
            name TEXT NOT NULL,
            height REAL,
            data BLOB
        )
    `).execute(db);

    await new RawQuery(`DELETE FROM test`).execute(db);
}

async function runTest(number: number, description: string, testFn: Function) {
    console.log(`Test ${number} - ${description}`);
    try {
        await testFn();
        console.log(`Test ${number} passes`);
    }
    catch (ex) {
        console.error(`Test ${number} failed |`, ex.message);
    }
}

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready')?.classList.add('ready');

    (async () => {
        await prepareTestDB();

        await runTest(1, 'insert works', async () => {
            await new InsertPersonQuery({
                id: 1,
                name: 'John Smith',
                height: 3.14,
                data: null
            }).execute(db);
        });
        await runTest(2, 'insert with blob works', async () => {
            await new InsertPersonQuery({
                id: 3,
                name: 'Tyler Breau',
                height: 5.8,
                data: new Blob([new Uint8Array([0x11])])
            }).execute(db);    
        });
        await runTest(3, 'transactions work', async () => {
            await new StartTransactionQuery().execute(db);
            await new InsertPersonQuery({
                id: 4,
                name: 'John Smith',
                height: 3.14,
                data: null
            }).execute(db);
            await new InsertPersonQuery({
                id: 5,
                name: 'Norman Breau',
                height: 5.7,
                data: null
            }).execute(db);
            await new CommitTransactionQuery().execute(db);
        });
        await runTest(4, 'select works', async () => {
            let data = (await new RawQuery('SELECT * FROM test where id = 5').execute(db))[0];
            if (
                data.id !== 5 ||
                data.name !== 'Norman Breau' ||
                data.height !== 5.7 ||
                data.data !== null
            ) {
                throw new Error(`Data did not match expectations | ${JSON.stringify(data)} | ${JSON.stringify({id: 5, name: 'Norman Breau', height: 5.7, data: null})}`);
            }
        });
        await runTest(5, 'update works', async () => {
            await new RawQuery('UPDATE test SET name = "bob" WHERE id = 5').execute(db);
            let data = (await new RawQuery('SELECT name FROM test where id = 5').execute(db))[0];
            if (data.name != "bob") {
                throw new Error(`Update didn't update. ${JSON.stringify(data)}`);
            }
        });
        await runTest(6, 'bulk insert works', async () => {
            await new BulkInsertPersonQuery(
                [
                    [ 6, "Bob", 1, null ],
                    [ 7, "Bob", 1, null ]
                ]
            ).execute(db);
            let data = (await new RawQuery('SELECT * FROM test where id = 6 OR id = 7').execute(db));
            if (
                data[0].id !== 6 ||
                data[0].name !== 'Bob' ||
                data[0].height !== 1 ||
                data[0].data !== null
            ) {
                throw new Error(`Data did not match expectations | ${JSON.stringify(data)} | ${JSON.stringify({id: 6, name: 'Bob', height: 1, data: null})}`);
            }
            if (
                data[1].id !== 7 ||
                data[1].name !== 'Bob' ||
                data[1].height !== 1 ||
                data[1].data !== null
            ) {
                throw new Error(`Data did not match expectations | ${JSON.stringify(data)} | ${JSON.stringify({id: 7, name: 'Bob', height: 1, data: null})}`);
            }
        });
        await runTest(7, 'bulk upsert works', async () => {
            await new BulkInsertPersonQuery(
                [
                    [ 8, "Bob", 1, null ],
                    [ 9, "Bob", 1, null ]
                ]
            ).execute(db);
            await new BulkInsertPersonQuery(
                [
                    [ 8, "Bob", 2, null ],
                    [ 9, "Bob", 2, null ]
                ]
            ).execute(db);
            let data = (await new RawQuery('SELECT * FROM test where id = 8 OR id = 9').execute(db));
            if (
                data[0].id !== 8 ||
                data[0].name !== 'Bob' ||
                data[0].height !== 2 ||
                data[0].data !== null
            ) {
                throw new Error(`Data did not match expectations | ${JSON.stringify(data)} | ${JSON.stringify({id: 8, name: 'Bob', height: 2, data: null})}`);
            }
            if (
                data[1].id !== 9 ||
                data[1].name !== 'Bob' ||
                data[1].height !== 2 ||
                data[1].data !== null
            ) {
                throw new Error(`Data did not match expectations | ${JSON.stringify(data)} | ${JSON.stringify({id: 9, name: 'Bob', height: 2, data: null})}`);
            }
        });
        await runTest(8, 'arrays are supported', async () => {
            await new RawQuery<SQLiteParams>('SELECT * FROM test WHERE id IN (:ids)', {
                ids: [1, 2, 3]
            }).execute(db);
            // Expect to not error
        });

        await runTest(9, 'multiple arrays params are supported', async () => {
            await new RawQuery<SQLiteParams>('SELECT * FROM test WHERE id IN (:ids) OR id IN (:ids)', {
                ids: [1, 2, 3]
            }).execute(db);
            // Expect to not error
        });

        await runTest(10, 'query parameter names supports alphanumeric and _', async () => {
            await new RawQuery<SQLiteParams>('', {
                abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_: "bob"
            });
        });

        await runTest(11, 'query parameter name\'s first character does not support numeric or underscore.', async () => {
            try {
                await new RawQuery<SQLiteParams>('', {
                    _: "bob"
                });
                throw new Error("Query Parameter Name supported first character _");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    0: "bob"
                });
                throw new Error("Query Parameter Name supported first character 0");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    1: "bob"
                });
                throw new Error("Query Parameter Name supported first character 1");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    2: "bob"
                });
                throw new Error("Query Parameter Name supported first character 2");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    3: "bob"
                });
                throw new Error("Query Parameter Name supported first character 3");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    4: "bob"
                });
                throw new Error("Query Parameter Name supported first character 4");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    5: "bob"
                });
                throw new Error("Query Parameter Name supported first character 5");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    6: "bob"
                });
                throw new Error("Query Parameter Name supported first character 6");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    7: "bob"
                });
                throw new Error("Query Parameter Name supported first character 7");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    8: "bob"
                });
                throw new Error("Query Parameter Name supported first character 8");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    9: "bob"
                });
                throw new Error("Query Parameter Name supported first character 9");
            }
            catch (ex) {/* consume expected error */}
        });

        await runTest(12, 'query parameter name does not support & as first character', async () => {
            try {
                await new RawQuery<SQLiteParams>('', {
                    $bob: "bob"
                });
                throw new Error("Query Parameter Name supported first character &");
            }
            catch (ex) {/* consume expected error */}
        });

        await runTest(13, 'query parameter name does not support &', async () => {
            try {
                await new RawQuery<SQLiteParams>('', {
                    b$ob: "bob"
                });
                throw new Error("Query Parameter Name supported character & in b$ob");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    bob$: "bob"
                });
                throw new Error("Query Parameter Name supported character & in bob$");
            }
            catch (ex) {/* consume expected error */}
            try {
                await new RawQuery<SQLiteParams>('', {
                    bob_$: "bob"
                });
                throw new Error("Query Parameter Name supported character & in bob_$");
            }
            catch (ex) {/* consume expected error */}
        });

        await runTest(14, 'BulkInsertQuery escapes columns correctly', async () => {
            let query = new BulkInsertColumnEscapeQuery(<TBulkInsertPersonQueryParams>{});
            let queryStr = query.getQuery();
            let expectation = "`id`,`name`,`test`.`height`,`test`.`data`";
            if (queryStr.indexOf(expectation) === -1) {
                throw new Error(`BulkInsertQuery did not properly escape column names. Expected "${queryStr}" to contain "${expectation}"`);
            }
        });

        let results = await new RawQuery('SELECT * FROM test').execute(db);
        for (let i = 0; i < results.length; i++) {
            console.log('RESULT', i, results[i]);
        }

        await runTest(15, 'backup db works', async() => {
            let path = cordova.file.dataDirectory + 'test.db';
            let backupPath = cordova.file.dataDirectory + 'test-backup.db'
            await SQLite.backup(path, backupPath);

            let backupdb = await SQLite.open(backupPath, true);
            let dbdata = await new RawQuery<void>('SELECT * FROM test ORDER BY id ASC').execute(db);
            let backupdata = await new RawQuery<void>('SELECT * FROM test ORDER BY id ASC').execute(backupdb);

            await SQLite.close(backupdb);
            if (JSON.stringify(dbdata) !== JSON.stringify(backupdata)) {
                throw new Error("Expected backup database to have identical data as source database.");
            }
        });

        await runTest(16, 'restore backup works', async() => {
            let path = cordova.file.dataDirectory + 'test.db';
            let backupPath = cordova.file.dataDirectory + 'test-backup.db'
            await SQLite.backup(path, backupPath);

            // Oops, we destroyed the database
            await new RawQuery('DELETE FROM test').execute(db);

            let dbdata = await new RawQuery<void>('SELECT * FROM test ORDER BY id ASC').execute(db);
            
            if (dbdata.length !== 0) {
                throw new Error("Expected test table to be empty.");
            }

            await SQLite.close(db);
            await SQLite.restoreBackup(path, backupPath);
            db = await SQLite.open(cordova.file.dataDirectory + 'test.db', true);
        
            dbdata = await new RawQuery<void>('SELECT * FROM test ORDER BY id ASC').execute(db);
            
            if (dbdata.length === 0) {
                throw new Error("Expected test table to be restored.");
            }
        });

        await SQLite.close(db);
    })().then(() => {
        console.log('done');
    }).catch((error) => {
        console.error('Test failed with error', error);
    });
}
