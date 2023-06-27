
import {
    SQLiteArray,
    SQLiteListArgs,
    SQLiteParams,
    SQLiteType,
    SQLiteValue,
    SQLiteBlob,
    SQLiteDouble,
    SQLiteInteger,
    SQLiteNull,
    SQLiteText
} from './SQLiteTypes';
import {SQLiteParamValueConverter} from './SQLiteParamValueConverter';

/**
 * @since v0.2.0
 */
export class SQLiteParamAdapter {
    public constructor() {}

    /**
     * Attempt to adapt an arbitrary data type to a supported SQLite Type
     * 
     * There is a set of default adaptions for common types including
     * null, strings and numbers which are all passthrough types. There is also
     * default adaptions for booleans, Dates and blobs, where booleans are
     * convered to an integer of 1 or 0, Dates are converted to an ISO string,
     * and blobs are adapted to a special JSON format to represent bytearrays.
     * 
     * If required, any of the _adapt* methods could be overwritten to change
     * the behaviour however it would be recommended to keep the defaults.
     * 
     * If you are importing custom types, override the `_adapt` method to handle
     * them.
     * 
     * @param v 
     * @returns 
     */
    private async $adapt(v: unknown): Promise<SQLiteType> {
        let out: SQLiteType;
        if (v === null) {
            out = this._adaptNull(<null>v);
        }
        else if (typeof v === 'number') {
            out = this._adaptNumber(v);
        }
        else if (typeof v === 'string') {
            out = this._adaptString(v);
        }
        else if (typeof v === 'boolean') {
            out = this._adaptBoolean(v);
        }
        else if (v instanceof Date) {
            out = this._adaptDate(v);
        }
        else if (v instanceof Blob) {
            out = await this._adaptBlob(v);
        }
        else if (v instanceof ArrayBuffer) {
            out = await this._adaptArrayBuffer(v);
        }
        else if ((v instanceof Int8Array) || (v instanceof Uint8Array)) {
            out = await this._adaptInt8TypedArray(v);
        }
        else {
            out = await this._adapt(v);
        }

        return out;
    }

    protected async _adaptInt8TypedArray(v: Int8Array | Uint8Array): Promise<SQLiteBlob> {
        return await SQLiteParamValueConverter.int8OrUint8ToSQLiteBlob(v);
    }

    protected async _adaptArrayBuffer(v: ArrayBuffer): Promise<SQLiteBlob> {
        return await SQLiteParamValueConverter.arrayBufferToSQLiteBlob(v);
    }

    protected async _adaptBlob(v: Blob): Promise<SQLiteBlob> {
        return await SQLiteParamValueConverter.blobToSQLiteBlob(v);
    }

    protected _adaptDate(v: Date): SQLiteText {
        if (v.toString() === 'Invalid Date') {
            throw new Error('Invalid Date');
        }
        return SQLiteParamValueConverter.dateToText(v);
    }

    protected _adaptBoolean(v: boolean): SQLiteInteger {
        return SQLiteParamValueConverter.booleanToInteger(v);
    }

    protected _adaptString(v: string): SQLiteText {
        return v;
    }

    protected _adaptNumber(v: number): SQLiteDouble | SQLiteInteger {
        return v;
    }

    protected _adaptNull(v: null): SQLiteNull {
        return null;
    }

    protected async _adapt(v: unknown): Promise<SQLiteType> {
        throw new Error('Hit an unknown type. This is an unsupported operation. To support custom types, extend SQLiteParamAdapter and implement the _adapt method.');
    }

    public async processArray(input: unknown[][]): Promise<SQLiteListArgs> {
        // any cause we need to match the array structure...
        let out: SQLiteListArgs = [];

        for (let i: number = 0; i < input.length; i++){ 
            let row: unknown[] = input[i];
            let outRow: SQLiteArray = [];
            for (let j: number = 0; j < row.length; j++) {
                let v: unknown = row[j];
                outRow.push(await this.$adapt(v));
            }
            
            out.push(outRow);
        }

        return out;
    }

    public async processKWargs(input: Record<string, unknown>): Promise<SQLiteParams> {
        let out: SQLiteParams = {};

        for (let i in input) {
            let inValue: unknown = input[i];

            if (inValue === undefined) {
                // skip undefined values, don't add it to the param object.
                continue;
            }
            
            let outValue: SQLiteValue;
            if (inValue instanceof Array) {
                if (inValue.length === 0) {
                    // skip empty sections, don't add it to param object
                    continue;
                }

                outValue = [];

                for (let j: number = 0; j < inValue.length; j++) {
                    outValue.push(await this.$adapt(inValue[j]));
                }
            }
            else {
                outValue = await this.$adapt(input[i]);
            }

            out[i] = outValue;
        }

        return out;
    }
}
