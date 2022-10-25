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

import {SERVICE_NAME} from './SQLite';
import { SQLiteParams } from './SQLiteTypes';
import {IDatabaseHandle} from './IDatabaseHandle';
import {IError} from './IError';

export abstract class Query<TParams, TResponse> {
    private $params: TParams;

    public constructor(params: TParams) {
        this.$params = params;
    }

    public abstract getQuery(): string;

    protected async _getParameters(params: TParams): Promise<SQLiteParams> {
        return;
    }

    public async execute(db: IDatabaseHandle): Promise<TResponse> {
        let params = await this._getParameters(this.$params);
        return new Promise<TResponse>((resolve, reject) => {
            cordova.exec(
                (data: any) => {
                    resolve(data);
                },
                (error: IError) => {
                    reject(error);
                },
                SERVICE_NAME,
                'query',
                [
                    {dbHandle: db.getHandle()},
                    this.getQuery(),
                    params
                ]
            );
        });
    }
}
