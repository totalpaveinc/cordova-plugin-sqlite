
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

export type SQLiteText = string;
export type SQLiteInteger = number;
export type SQLiteDouble = number;
export type SQLiteBlob = IByteArray;
export type SQLiteNull = null;
export type SQLiteType = SQLiteText | SQLiteDouble | SQLiteInteger | SQLiteNull | SQLiteBlob;
export type SQLiteParams = Record<string, SQLiteType>;
