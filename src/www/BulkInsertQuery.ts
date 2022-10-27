
import {Query} from './Query';
import {SQLiteType} from './SQLiteTypes';

export type TBulkInsertParams = Array<Array<unknown>>;
type TSQLiteParams = Array<Array<SQLiteType>>;

export abstract class BulkInsertQuery<TParams extends TSQLiteParams> extends Query<TParams, void, TSQLiteParams> {
    public getQuery(): string {
        return `
            INSERT INTO ${this._getTable()}
            (
                ${this._getColumns().join(",")}
            )
            :BulkInsertValue
            ${this._getOnConflict()}
        `;
    }

    protected _validateParameterNames() { /* No-op because we never have parameter names to validate */ }

    protected override _getNativeMethod(): string {
        return 'bulkInsert';
    }

    protected override async _getParameters(params: TParams): Promise<TSQLiteParams> {
        return params;
    }

    /**
     * Value will not be sanitized.
     */
    protected abstract _getTable(): string;
    /**
     * Value will not be sanitized.
     */
    protected abstract _getColumns(): Array<string>;
    /**
     * Override this to provide the ON CONFLICT (column) DO UPDATE clause.
     * Value will not be sanitized.
     * 
     * Return Value Example:
     * 
     *     ON CONFLICT (id) DO UPDATE SET
     *         sourceTarget = excluded.sourceTarget,
     *         sourceVersion = excluded.sourceVersion
     */
    protected _getOnConflict(): string {
        return "";
    }
}
