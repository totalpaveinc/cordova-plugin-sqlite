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

import {Query} from './Query';
import {TransactionMode} from './TransactionMode'

export class StartTransactionQuery extends Query<void, void> {
    private $mode: TransactionMode;

    /**
     * @param mode See https://www.sqlite.org/lang_transaction.html
     */
    public constructor(mode: TransactionMode = TransactionMode.DEFERRED) {
        super();
        this.$mode = mode;
    }

    public override getQuery(): string {
        // Note, don't use string manipulation
        // as malicious actors could override $mode in
        // the JS runtime.
        let sql: string;
        switch (this.$mode) {
            case TransactionMode.DEFERRED:
                sql = 'BEGIN DEFERRED TRANSACTION';
                break;
            case TransactionMode.EXCLUSIVE:
                sql = 'BEGIN EXCLUSIVE TRANSACTION';
                break;
            case TransactionMode.IMMEDIATE:
                sql = 'BEGIN IMMEDIATE TRANSACTION';
                break;
        }

        if (!sql) {
            throw new Error('Invalid TransactionMode');
        }
        
        return sql;
    }
}
