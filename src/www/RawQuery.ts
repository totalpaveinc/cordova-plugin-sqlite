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
import {SQLiteParams} from './SQLiteTypes';

export class RawQuery<TParams extends SQLiteParams | void = SQLiteParams, TResponse = any> extends Query<TParams, TResponse, TParams> {
    private $sql: string;

    public constructor(sql: string, params?: TParams) {
        super(params);
        this.$sql = sql;
    }

    protected async _getParameters(params: TParams): Promise<TParams> {
        return params;
    }

    public override getQuery(): string {
        return this.$sql;
    }
}
