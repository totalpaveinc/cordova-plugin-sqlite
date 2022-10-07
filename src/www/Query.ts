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
import { SQLiteDouble, SQLiteInteger, SQLiteText } from './SQLiteTypes';
import {IDatabaseHandle} from './IDatabaseHandle';
import {IError} from './IError';

/**
 * @internal
 */
export interface IComplexParamValue<T> {
    type: string;
    value: T
}

/**
 * @internal - Do not construct this manually. Use `SQLiteBlob` type instead.
 */
export interface IByteArray extends IComplexParamValue<Array<number>> {
    type: 'bytearray';
}

// Commented out cause I'm not sure if this is the best approach. Timestamps
// cannot safely be represented by int16, thus we wil probably need to use a string approach.
// export interface IDateValue extends IComplexParamValue<number> {
//     type: 'date'
// }

type TInternalTypedArray =  Uint8Array  | Int8Array     |
                            Uint16Array | Int16Array    |
                            Uint32Array | Int32Array;
type TBinaryTypes = Blob | ArrayBuffer | TInternalTypedArray;

export type TParamsValue = SQLiteText | SQLiteDouble | SQLiteInteger | IByteArray/* | IDateValue*/;
export type TParamsObject = Record<string, TParamsValue>;

/**
 * Builds a params object for Queries.
 * In most cases, you can probably simply pass in a JSON object
 * that consists of strings, integers or floating point numbers.
 * 
 * SQLite doesn't have a boolean type, (they are simply just an integer of 0 or 1).
 * 
 * Blobs/byte arrays are supported, but requires additional work, where this ParamBuilder
 * handles.
 */
export class ParamBuilder<T> {
    private $params: any;

    public constructor() {
        this.$params = {};
    }

    public set(key: keyof T, value: T[keyof T] | TBinaryTypes): ParamBuilder<T> {
        this.$params[key] = value;
        return this;
    }

    /**
     * Builds a usable copy of a params object that can
     * be parsed by the native side.
     * 
     * @returns
     */
    public async build(): Promise<T> {
        let out: any = {};
        
        for (let key in this.$params) {
            let v: any = this.$params[key];
            if (typeof v === 'string' || typeof v === 'number') {
                out[key] = v;
            }
            else if (typeof v === 'boolean') {
                out[key] = v ? 1 : 0;
            }
            else if (v instanceof Blob) {
                out[key] = {
                    type: 'bytearray',
                    value: this.$normalizeBufferedArray(new Uint8Array(await this.$getArrayBufferFromBlob(v)))
                };
            }
            /*else if (v instanceof Date) {
                out[k] = {
                    type: 'date',
                    value: v.getTime()
                };
            }*/
            else if (v instanceof ArrayBuffer) {
                out[key] = {
                    type: 'bytearray',
                    value: this.$normalizeBufferedArray(new Uint8Array(v))
                };
            }
            else if (
                v instanceof Uint8Array ||
                v instanceof Int8Array ||
                v instanceof Uint16Array ||
                v instanceof Int16Array ||
                v instanceof Uint32Array ||
                v instanceof Int32Array
             ) {
                out[key] = {
                    type: 'bytearray',
                    value: this.$normalizeBufferedArray(v)
                };
            }
            else {
                console.warn('Skipping parameter key', key, 'because it\'s an unrecognizable type.');
            }
        }

        return <T>out;
    }

    private $normalizeBufferedArray(ta: TInternalTypedArray): Array<number> {
        let out: Array<number> = [];

        for (let i: number = 0; i < ta.length; i++) {
            out.push(ta[i]);
        }

        return out;
    }

    private async $getArrayBufferFromBlob(value: Blob): Promise<ArrayBuffer> {
        let ab: ArrayBuffer = null;
        if (value.arrayBuffer) {
            ab = await value.arrayBuffer();
        }
        else {
            // If the arrayBuffer method is not available, then
            // we need to read it manually.
            ab = await new Promise<ArrayBuffer>((resolve, reject) => {
                let reader: FileReader = new FileReader();

                // event handlers needs to be manually detached
                // to avoid memory leaks
                // https://developer.mozilla.org/en-US/docs/Web/API/FileReader#events
                const onLoadEnd = () => {
                    if (reader.error) {
                        reject(reader.error);
                        return;
                    }

                    resolve(<ArrayBuffer>reader.result);
                };

                reader.addEventListener('loadend', () => {
                    reader.removeEventListener('loadend', onLoadEnd);
                });

                reader.readAsArrayBuffer(value);
            });
        }

        return ab;
    }
}

export abstract class Query<TParams, TResponse> {
    private $params: TParams;

    public constructor(params: TParams) {
        this.$params = params;
    }

    public abstract getQuery(): string;

    public async execute(db: IDatabaseHandle): Promise<TResponse> {
        return new Promise<TResponse>((resolve, reject) => {
            cordova.exec((data: any) => {
                resolve(data);
            }, (error: IError) => {
                reject(error);
            }, SERVICE_NAME, 'query', [{dbHandle: db.getHandle()}, this.getQuery(), this.$params]);
        });
    }
}
