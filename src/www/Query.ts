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
import {SQLiteParamAdapter} from './SQLiteParamAdapter';

/**
 * Before v0.2.0 TParams can hold anything, as long as you filtered out
 * non-query parameters inside _getParameters.
 * 
 * @since v0.2.0
 * 
 * TParams must only contain query parameters. Additional query options can be passed
 * as an another argument if desired. Implementing _getParameters is now optional
 * and the default implementation of it will automatically convert several
 * well known types into the appropriate SQLite type.
 * 
 * Custom type adaptions can be implemented by providing a custom SQLiteParamAdapter.
 * 
 * If you can guarentee that the TParams consists of only valid SQLite Types, then
 * the _useParamsPassthrough can be used to skip the adaption step, which might be
 * a significant performance gain on large param queries, such as bulk inserts.
 */
export abstract class Query<TParams, TResponse> {
    private $params: TParams;
    private $paramAdapter: SQLiteParamAdapter;

    public constructor(params: TParams) {
        this.$params = params;
        this.$paramAdapter = this._createParamAdapter();
    }

    /**
     * @since v0.2.0
     * @returns 
     */
    protected _createParamAdapter(): SQLiteParamAdapter {
        return new SQLiteParamAdapter();
    }

    protected _validateParameterNames(params: SQLiteParams) {
        for (let key in params) {
            if (!(/^([a-zA-Z])+([a-zA-Z0-9_]+)/.test(key))) {
                throw new Error("Query parameter name contained invalid character. Parameter name should only contain alphanumeric or underscore characters. The first charater must be an alphebetical letter.")
            }
        }
    }

    public abstract getQuery(): string;

    /**
     * Returns the parameters as given to the Query
     * @returns 
     */
    public getParams(): TParams {
        return this.$params;
    }

    /**
     * Return true if this query should skip parameter type conversion and
     * simply passthrough params as is. If it can be guarenteed that the source
     * params are of acceptable SQLite types, then this can potentially give
     * a performance boost, especially on bulk insert queries.
     * 
     * Defaults to false
     */
    protected _useParamsPassthrough(): boolean {
        return false;
    }

    /**
     * Implement to translate unknown parameter types into valid SQL data types
     * @param params 
     * @returns 
     */
    protected async _getParameters(params: TParams): Promise<SQLiteParams> {
        if (this._useParamsPassthrough()) {
            return <SQLiteParams>params;
        }

        if (!params) {
            return null;
        }

        let out: SQLiteParams;
        if (params instanceof Array) {
            out = await this.$paramAdapter.processArray(params);
        }
        else if (typeof params === 'object') {
            out = await this.$paramAdapter.processKWargs(<Record<string, unknown>>params);
        }

        return out;
    }

    /**
     * @internal function that controls which native API to call. Don't touch this.
     */
     protected _getNativeMethod(): string {
        return 'query';
    }

    public async execute(db: IDatabaseHandle): Promise<TResponse> {
        let params: SQLiteParams = await this._getParameters(this.$params);
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
