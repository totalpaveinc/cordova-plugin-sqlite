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

/**
 * @internal TSQLiteParams
 */
export abstract class Query<TParams, TResponse, TSQLiteParams = SQLiteParams> {
    private $params: TParams;

    public constructor(params: TParams) {
        this.$params = params;
    }

    protected _validateParameterNames(params: TSQLiteParams) {
        for (let key in params) {
            if (!(/^([a-zA-Z])+([a-zA-Z0-9_]+)/.test(key))) {
                throw new Error("Query parameter name contained invalid character. Parameter name should only contain alphanumeric or underscore characters. The first charater must be an alphebetical letter.")
            }
        }
    }

    public abstract getQuery(): string;

    protected async _getParameters(params: TParams): Promise<TSQLiteParams> {
        return;
    }

    /**
     * @internal function that controls which native API to call. Don't touch this.
     */
     protected _getNativeMethod(): string {
        return 'query';
    }

    public async execute(db: IDatabaseHandle): Promise<TResponse> {
        let params: TSQLiteParams = await this._getParameters(this.$params);
        this._validateParameterNames(params); // _getParameters is able to create or remove parameter keys. As a result, we must validate the returned value of _getParameters.
        return new Promise<TResponse>((resolve, reject) => {
            cordova.exec(
                (data: any) => {
                    resolve(data);
                },
                (error: IError) => {
                    reject(error);
                },
                SERVICE_NAME,
                this._getNativeMethod(),
                [
                    {dbHandle: db.getHandle()},
                    this.getQuery(),
                    params
                ]
            );
        });
    }
}
