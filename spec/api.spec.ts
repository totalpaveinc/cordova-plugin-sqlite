
import * as api from '../src/www/api';

import {BulkInsertQuery} from '../src/www/BulkInsertQuery';
import {CommitTransactionQuery} from '../src/www/CommitTransactionQuery';
import {CreateIndexQuery} from '../src/www/CreateIndexQuery';
import {Database} from '../src/www/Database';
import {Query} from '../src/www/Query';
import {RawQuery} from '../src/www/RawQuery';
import {RollbackTransactionQuery} from '../src/www/RollbackTransactionQuery';
import {StartTransactionQuery} from '../src/www/StartTransactionQuery';
import {TransactionMode} from '../src/www/TransactionMode';
import {SQLite} from '../src/www/SQLite';
import {SQLiteParamAdapter} from '../src/www/SQLiteParamAdapter';
import {SQLiteParamValueConverter} from '../src/www/SQLiteParamValueConverter';

describe('Public API', () => {
    it('BulkInsertQuery', () => {
        expect(api.BulkInsertQuery).toBe(BulkInsertQuery);
    });

    it('CommitTransactionQuery', () => {
        expect(api.CommitTransactionQuery).toBe(CommitTransactionQuery);
    });

    it('CreateIndexQuery', () => {
        expect(api.CreateIndexQuery).toBe(CreateIndexQuery);
    });

    it('Database', () => {
        expect(api.Database).toBe(Database);
    });

    it('Query', () => {
        expect(api.Query).toBe(Query);
    });

    it('RawQuery', () => {
        expect(api.RawQuery).toBe(RawQuery);
    });

    it('RollbackTransactionQuery', () => {
        expect(api.RollbackTransactionQuery).toBe(RollbackTransactionQuery);
    });

    it('StartTransactionQuery', () => {
        expect(api.StartTransactionQuery).toBe(StartTransactionQuery);
    });

    it('TransactionMode', () => {
        expect(api.TransactionMode).toBe(TransactionMode);
    });

    it('SQLite', () => {
        expect(api.SQLite).toBe(SQLite);
    });

    it('SQLiteParamAdapter', () => {
        expect(api.SQLiteParamAdapter).toBe(SQLiteParamAdapter);
    });

    it('SQLiteParamValueConverter', () => {
        expect(api.SQLiteParamValueConverter).toBe(SQLiteParamValueConverter);
    });
});
