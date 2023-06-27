
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

/**
 * @since v0.2.0
 */
export type SQLiteArray<TSQLiteType extends SQLiteType = SQLiteType> = TSQLiteType[];


/**
 * @since v0.2.0
 */
export type SQLiteKWargs = Record<string, SQLiteType | SQLiteArray>;

/**
 * @since v0.2.0
 */
export type SQLiteListArgs = SQLiteType[][];

/**
 * @since v0.2.0
 */
export type SQLiteValue = SQLiteType | SQLiteArray;

export type SQLiteParams = SQLiteKWargs | SQLiteListArgs;
