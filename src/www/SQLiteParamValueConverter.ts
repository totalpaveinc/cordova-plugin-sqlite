
import { SQLiteInteger, SQLiteDouble, SQLiteNull, SQLiteText, SQLiteBlob } from './SQLiteTypes';

type TInternalTypedArray =  Uint8Array  | Int8Array;
const NativeFileReader = window.FileReader; // Hold a reference to FileReader before plugins like cordova-plugin-file overwrites it.

export class SQLiteParamValueConverter {
    public static numberToInteger(value: number): SQLiteInteger {
        return value;
    }

    public static numberToDouble(value: number): SQLiteDouble {
        return value;
    }

    public static booleanToInteger(value: boolean): SQLiteInteger {
        return value ? 1 : 0;
    }

    public static nullOrUndefinedToSQLiteNull(value: null | undefined): SQLiteNull {
        return null;
    }

    public static dateToText(value: Date): SQLiteText {
        return value.toISOString();
    }

    public static stringToText(value: string): SQLiteText {
        return value;
    }

    public static async blobToSQLiteBlob(value: Blob): Promise<SQLiteBlob> {
        return {
            type: 'bytearray',
            value: SQLiteParamValueConverter.$normalizeBufferedArray(new Uint8Array(await SQLiteParamValueConverter.$getArrayBufferFromBlob(value)))
        };
    }

    public static async arrayBufferToSQLiteBlob(value: ArrayBuffer): Promise<SQLiteBlob> {
        return {
            type: 'bytearray',
            value: SQLiteParamValueConverter.$normalizeBufferedArray(new Uint8Array(value))
        };
    }

    public static async int8OrUint8ToSQLiteBlob(value: Uint8Array | Int8Array): Promise<SQLiteBlob> {
        return {
            type: 'bytearray',
            value: SQLiteParamValueConverter.$normalizeBufferedArray(value)
        };
    }

    private static $normalizeBufferedArray(ta: TInternalTypedArray): Array<number> {
        let out: Array<number> = [];

        for (let i: number = 0; i < ta.length; i++) {
            out.push(ta[i]);
        }

        return out;
    }

    private static async $getArrayBufferFromBlob(value: Blob): Promise<ArrayBuffer> {
        let ab: ArrayBuffer;
        if (value.arrayBuffer) {
            ab = await value.arrayBuffer();
        }
        else {
            // If the arrayBuffer method is not available, then
            // we need to read it manually.
            ab = await new Promise<ArrayBuffer>((resolve, reject) => {
                let reader = new NativeFileReader();

                // event handlers needs to be manually detached
                // to avoid memory leaks
                // https://developer.mozilla.org/en-US/docs/Web/API/FileReader#events
                const onLoadEnd = () => {
                    reader.removeEventListener('loadend', onLoadEnd);
                    if (reader.error) {
                        reject(reader.error);
                        return;
                    }

                    resolve(<ArrayBuffer>reader.result);
                };

                reader.addEventListener('loadend', onLoadEnd);

                reader.readAsArrayBuffer(value);
            });
        }

        return ab;
    }
}
