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
    Query,
    StartTransactionQuery,
    CommitTransactionQuery,
    SQLiteParamValueConverter,
    SQLiteInteger,
    SQLiteText,
    SQLiteDouble,
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

document.addEventListener('deviceready', onDeviceReady, false);

let db: Database;

async function prepareTestDB() {
    db = await SQLite.open(cordova.file.dataDirectory + 'test.db', true);
    await new RawQuery(`
        CREATE TABLE IF NOT EXISTS test (
            id INTEGER NOT NULL,
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
        console.error(`Test ${number} failed | ${ex}`);
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

        let results = await new RawQuery('SELECT * FROM test').execute(db);
        for (let i = 0; i < results.length; i++) {
            console.log('RESULT', i, results[i]);
        }

        await SQLite.close(db);
    })().then(() => {
        console.log('done');
    }).catch((error) => {
        console.error('Test failed with error', error);
    });
}
