
import {Query} from './Query';
import {SQLiteType} from './SQLiteTypes';

export type TBulkInsertParams = Array<Array<SQLiteType>>;

export abstract class BulkInsertQuery<TParams extends TBulkInsertParams> extends Query<TParams, void, TBulkInsertParams> {
    private $escapeColumn(column: string): string {
        let pieces: Array<string> = column.split('.');
        if (pieces[0].charAt(0) != '`') {
            pieces[0] = `\`${pieces[0]}\``;
        }
        if (pieces[1] && pieces[1].charAt(0) != '`') {
            pieces[1] = `\`${pieces[1]}\``;
        }

        return pieces[0] + (pieces[1] ? `.${pieces[1]}` : '');
    }

    public getQuery(): string {
        let columns: Array<string> = this._getColumns().slice();
        for (let i = 0; i < columns.length; ++i ){
            columns[i] = this.$escapeColumn(columns[i]);
        }
        return `
            INSERT INTO ${this._getTable()}
            (
                ${columns.join(",")}
            )
            :BulkInsertValue
            ${this._getOnConflict()}
        `;
    }

    protected _validateParameterNames() { /* No-op because we never have parameter names to validate */ }

    protected override _getNativeMethod(): string {
        return 'bulkInsert';
    }

    protected override async _getParameters(params: TParams): Promise<TBulkInsertParams> {
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