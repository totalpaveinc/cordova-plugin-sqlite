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
import { Database } from './Database';

export interface IComplexParamValue<T> {
    type: string;
    value: T
}

export interface IByteArray extends IComplexParamValue<Array<number>> {
    type: 'bytearray';
}

// Commented out cause I'm not sure if this is the best approach. Timestamps
// cannot safely be represented by int16, thus we wil probably need to use a string approach.
// export interface IDateValue extends IComplexParamValue<number> {
//     type: 'date'
// }

type TInternalParamsValue = string | number | IByteArray /*| IDateValue*/ | Blob | boolean | Date | ArrayBuffer | Uint8Array;
type TInternalParamsObject = Map<string, TInternalParamsValue>;
type TInternalTypedArray =  Uint8Array  | Int8Array     |
                            Uint16Array | Int16Array    |
                            Uint32Array | Int32Array;

export type TParamsValue = string | number | IByteArray/* | IDateValue*/;
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
export class ParamBuilder {
    private $params: TInternalParamsObject;

    public constructor() {
        this.$params = new Map();
    }

    public setNumber(key: string, value: number): ParamBuilder {
        this.$params.set(key, value);
        return this;
    }

    public setBoolean(key: string, value: boolean): ParamBuilder {
        this.$params.set(key, value ? 1 : 0);
        return this;
    }

    public setString(key: string, value: string): ParamBuilder {
        this.$params.set(key, value);
        return this;
    }

    public setArrayBuffer(key: string, value: ArrayBuffer): ParamBuilder {
        this.$params.set(key, value);
        return this;
    }

    public setBytes(key: string, value: Uint8Array): ParamBuilder {
        this.$params.set(key, value);
        return this;
    }

    public setBlob(key: string, value: Blob): ParamBuilder {
        this.$params.set(key, value);
        return this;
    }

    /**
     * Builds a usable copy of a params object that can
     * be parsed by the native side.
     * 
     * @returns
     */
    public async build(): Promise<TParamsObject> {
        let out: TParamsObject = {};
        
        for (let [key, v] of this.$params) {
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
                out[key] = {
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
            else if (v instanceof Uint8Array) {
                out[key] = {
                    type: 'bytearray',
                    value: this.$normalizeBufferedArray(v)
                };
            }
            else {
                console.warn('Skipping parameter key', key, 'because it\'s an unrecognizable type.');
            }
        }

        return out;
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

    public async execute(db: Database): Promise<TResponse> {
        return new Promise<TResponse>((resolve, reject) => {
            cordova.exec((data: any) => {
                resolve(data);
            }, (error: any) => {
                reject(error);
            }, SERVICE_NAME, 'query', [db.getHandle(), this.getQuery(), this.$params]);
        });
    }
}
