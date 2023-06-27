
import {Query} from './Query';

/**
 * @since v0.2.0
 */
export interface ICreateIndexQueryParams {
    indexName: string;
    tableName: string;
    columnName: string;
}

/**
 * @since v0.2.0
 */
export class CreateIndexQuery extends Query<void, void> {
    private $options: ICreateIndexQueryParams;

    public constructor(options: ICreateIndexQueryParams) {
        super();
        this.$options = options;
    }

    private $sanitize(value: string): string {
        if (typeof value !== 'string') {
            value = JSON.stringify(value);
        }

        return `\`${value}\``;
    }

    public override getQuery(): string {
        let options: ICreateIndexQueryParams = this.$options;
        return `
            CREATE INDEX IF NOT EXISTS ${this.$sanitize(options.indexName)}
            ON ${this.$sanitize(options.tableName)} (${this.$sanitize(options.columnName)})
        `;
    }
}
