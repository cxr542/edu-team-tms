import { describe, expect, it } from 'vitest';
import {
  LedgerApiError,
  bulkUpsertTransactions,
  deleteTransaction,
  insertTransaction,
  normalizeTransactionInput,
  putSetting,
  replaceCategories,
  updateTransaction,
} from '../server/api-utils/ledgerWriteCore.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

const tx = (over = {}) => ({
  id: 'a',
  date: '2026-09-03',
  category: '티타임',
  description: 'x',
  amount: 5000,
  paymentMethod: '법인카드',
  attendees: '팀 모두',
  ...over,
});
const balances = (db) =>
  Object.fromEntries(db.tables.ledger_transactions.map((r) => [r.id, r.balance]));
const code = async (p) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(LedgerApiError);
    return `${e.status}:${e.code}`;
  }
  return 'no-error';
};

describe('normalizeTransactionInput', () => {
  it('maps fields and generates an id when missing', () => {
    const row = normalizeTransactionInput(tx({ id: undefined, extraData: { 비고: 'n' } }));
    expect(row).toMatchObject({ tx_date: '2026-09-03', amount: 5000, payment_method: '법인카드', extra_data: { 비고: 'n' } });
    expect(row.id).toMatch(/^tx-/);
  });
  it('rejects bad dates, non-integer amounts and bad ids', async () => {
    expect(await code(Promise.resolve().then(() => normalizeTransactionInput(tx({ date: '2026-02-30' }))))).toBe('400:invalid-input');
    expect(await code(Promise.resolve().then(() => normalizeTransactionInput(tx({ amount: 1.5 }))))).toBe('400:invalid-input');
    expect(await code(Promise.resolve().then(() => normalizeTransactionInput(tx({ id: 'a b/c' }))))).toBe('400:invalid-input');
    expect(await code(Promise.resolve().then(() => normalizeTransactionInput(tx({ category: ' ' }))))).toBe('400:invalid-input');
  });
});

describe('row-level writes', () => {
  it('insert appends, computes balance from the monthly budget and returns the row', async () => {
    const db = makeFakeSupabase();
    const a = await insertTransaction(db, tx({ id: 'a', amount: 5000 }));
    const b = await insertTransaction(db, tx({ id: 'b', amount: 3000 }));
    expect(a.balance).toBe(40000); // 45,000 budget from 2026-09
    expect(b.sort_order).toBeGreaterThan(a.sort_order);
    expect(balances(db)).toEqual({ a: 40000, b: 37000 });
  });

  it('uses the 150,000 budget before 2026-09', async () => {
    const db = makeFakeSupabase();
    await insertTransaction(db, tx({ id: 'o', date: '2026-08-31', amount: 10000 }));
    expect(balances(db).o).toBe(140000);
  });

  it('rejects a duplicate id with 409', async () => {
    const db = makeFakeSupabase();
    await insertTransaction(db, tx());
    expect(await code(insertTransaction(db, tx()))).toBe('409:duplicate-id');
  });

  it('update rebalances the month without bumping other rows version', async () => {
    const db = makeFakeSupabase();
    await insertTransaction(db, tx({ id: 'a', amount: 5000 }));
    await insertTransaction(db, tx({ id: 'b', amount: 3000 }));
    const bBefore = db.tables.ledger_transactions.find((r) => r.id === 'b');
    const bVersion = bBefore.version;
    const updated = await updateTransaction(db, 'a', tx({ id: 'a', amount: 10000 }), 1);
    expect(updated.version).toBe(2);
    expect(balances(db)).toEqual({ a: 35000, b: 32000 });
    expect(db.tables.ledger_transactions.find((r) => r.id === 'b').version).toBe(bVersion); // balance-only change
  });

  it('update detects a stale version (409) and a missing row (404)', async () => {
    const db = makeFakeSupabase();
    await insertTransaction(db, tx({ id: 'a' }));
    await updateTransaction(db, 'a', tx({ id: 'a', amount: 1 }), 1);
    expect(await code(updateTransaction(db, 'a', tx({ id: 'a', amount: 2 }), 1))).toBe('409:version-conflict');
    expect(await code(updateTransaction(db, 'zzz', tx({ id: 'zzz' }), 1))).toBe('404:not-found');
    expect(await code(updateTransaction(db, 'a', tx({ id: 'a' }), undefined))).toBe('400:invalid-input');
  });

  it('moving a row to another month rebalances both months', async () => {
    const db = makeFakeSupabase();
    await insertTransaction(db, tx({ id: 'a', date: '2026-09-03', amount: 5000 }));
    await insertTransaction(db, tx({ id: 'b', date: '2026-09-04', amount: 3000 }));
    await updateTransaction(db, 'a', tx({ id: 'a', date: '2026-10-02', amount: 5000 }), 1);
    expect(balances(db)).toEqual({ a: 40000, b: 42000 });
  });

  it('delete is version-guarded and rebalances the month', async () => {
    const db = makeFakeSupabase();
    await insertTransaction(db, tx({ id: 'a', amount: 5000 }));
    await insertTransaction(db, tx({ id: 'b', amount: 3000 }));
    expect(await code(deleteTransaction(db, 'a', 9))).toBe('409:version-conflict');
    await deleteTransaction(db, 'a', 1);
    expect(balances(db)).toEqual({ b: 42000 });
    expect(await code(deleteTransaction(db, 'a', 1))).toBe('404:not-found');
  });
});

describe('bulkUpsertTransactions', () => {
  it('merge adds new and overwrites same-id rows, keeping others', async () => {
    const db = makeFakeSupabase();
    await insertTransaction(db, tx({ id: 'keep', amount: 1000 }));
    await insertTransaction(db, tx({ id: 'edit', amount: 2000 }));
    const res = await bulkUpsertTransactions(db, [tx({ id: 'edit', amount: 4000 }), tx({ id: 'new', amount: 500 })]);
    expect(res).toEqual({ added: 1, updated: 1, removed: 0 });
    expect(balances(db)).toEqual({ keep: 44000, edit: 40000, new: 39500 });
  });

  it('is idempotent: repeating the same import changes nothing', async () => {
    const db = makeFakeSupabase();
    const list = [tx({ id: 'a', amount: 1000 }), tx({ id: 'b', amount: 2000 })];
    await bulkUpsertTransactions(db, list);
    const snapshot = JSON.stringify(db.tables.ledger_transactions);
    const res = await bulkUpsertTransactions(db, list);
    expect(res).toEqual({ added: 0, updated: 2, removed: 0 });
    expect(JSON.stringify(db.tables.ledger_transactions)).toBe(snapshot);
  });

  it('replace needs confirmReplace and then removes rows not in the list', async () => {
    const db = makeFakeSupabase();
    await insertTransaction(db, tx({ id: 'gone', amount: 1000 }));
    expect(await code(bulkUpsertTransactions(db, [tx({ id: 'a' })], { mode: 'replace' }))).toBe('400:confirm-required');
    expect(db.tables.ledger_transactions).toHaveLength(1);
    const res = await bulkUpsertTransactions(db, [tx({ id: 'a', amount: 2000 })], { mode: 'replace', confirmReplace: true });
    expect(res).toEqual({ added: 1, updated: 0, removed: 1 });
    expect(balances(db)).toEqual({ a: 43000 });
  });

  it('validates everything before writing anything', async () => {
    const db = makeFakeSupabase();
    expect(await code(bulkUpsertTransactions(db, [tx({ id: 'ok' }), tx({ id: 'bad', date: 'nope' })]))).toBe('400:invalid-input');
    expect(await code(bulkUpsertTransactions(db, [tx({ id: 'd' }), tx({ id: 'd' })]))).toBe('400:invalid-input');
    expect(db.tables.ledger_transactions).toHaveLength(0);
  });
});

describe('categories and settings', () => {
  it('replaceCategories upserts and removes the rest', async () => {
    const db = makeFakeSupabase({ ledger_categories: [{ id: 'old', label: 'o', version: 1 }] });
    const res = await replaceCategories(db, [{ id: 'snack', label: '간식', matchKeywords: ['간식'] }]);
    expect(res).toEqual({ count: 1, removed: 1 });
    expect(db.tables.ledger_categories.map((c) => c.id)).toEqual(['snack']);
  });

  it('putSetting inserts once, then requires the current version', async () => {
    const db = makeFakeSupabase();
    const first = await putSetting(db, 'viewer_menu_visibility', { ledger: true });
    expect(first.version).toBe(1);
    expect(await code(putSetting(db, 'viewer_menu_visibility', { ledger: false }, 5))).toBe('409:version-conflict');
    const next = await putSetting(db, 'viewer_menu_visibility', { ledger: false }, 1);
    expect(next).toMatchObject({ value: { ledger: false }, version: 2 });
    expect(await code(putSetting(db, 'unknown', {}))).toBe('400:invalid-input');
  });
});
