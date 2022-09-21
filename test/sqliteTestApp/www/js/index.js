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
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready').classList.add('ready');

    class InsertPersonQuery extends window.totalpave.sqlite.Query {
        getQuery() {
            return `
                INSERT INTO test VALUES (
                    :id,
                    :name,
                    :height,
                    :data
                )
            `;
        }
    }

    const SQLite = window.totalpave.sqlite.SQLite;

    (async () => {
        let db = await SQLite.open(cordova.file.dataDirectory + 'test.db', true);

        await new window.totalpave.sqlite.RawQuery(`
            CREATE TABLE IF NOT EXISTS test (
                id INTEGER NOT NULL,
                name TEXT NOT NULL,
                height REAL,
                data BLOB
            )
        `).execute(db);

        await new window.totalpave.sqlite.RawQuery(`DELETE FROM test`).execute(db);
        
        await new InsertPersonQuery({
            id: 1,
            name: 'John Smith',
            height: 3.14,
            data: null
        }).execute(db);
        await new InsertPersonQuery({
            id: 2,
            name: 'Norman Breau',
            height: 5.7,
            data: null
        }).execute(db);

        let builder = new window.totalpave.sqlite.ParamBuilder();
        builder.setNumber('id', 3)
            .setString('name', 'Tyler Breau')
            .setNumber('height', 5.8)
            .setBlob('data', new Blob([new Uint8Array([0x11])]));

        await new InsertPersonQuery(
            await builder.build()
        ).execute(db);
        //     {
        //     id: 1,
        //     name: 'Tyler Breau',
        //     height: 5.8,
        //     data: new Blob([[0x11]])
        // }).execute(db);

        let results = await new window.totalpave.sqlite.RawQuery('SELECT * FROM test').execute(db);
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
