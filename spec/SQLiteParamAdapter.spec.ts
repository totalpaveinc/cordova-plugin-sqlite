
import {SQLiteParamAdapter} from '../src/www/SQLiteParamAdapter';

describe('SQLiteParamAdapter', () => {
    let adapter: SQLiteParamAdapter = null;

    beforeEach(() => {
        adapter = new SQLiteParamAdapter();
    });

    it('should throw on invalid dates', async () => {
        await expect(async () => {
            await adapter.processKWargs({
                d: new Date(NaN)
            });
        }).rejects.toThrow(/Invalid Date/);
    });
});
