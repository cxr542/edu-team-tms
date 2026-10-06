import { describe, expect, it } from 'vitest';
import {
  CAT_KEYS,
  TX_KEYS,
  classifyRows,
  summarize,
  toCategoryRow,
  toSettingRows,
  toTransactionRow,
  validateSnapshot,
} from '../scripts/ledger-migration-core.mjs';

const tx = {
  id: 'tx-1',
  date: '2026-10-02',
  category: '티타임',
  description: '카페',
  amount: 5800,
  balance: 39200,
  paymentMethod: '법인카드',
  attendees: '팀 모두',
};

describe('ledger migration core', () => {
  it('keeps the original id and defaults extra_data to an object', () => {
    const row = toTransactionRow(tx, 3);
    expect(row).toMatchObject({ id: 'tx-1', tx_date: '2026-10-02', amount: 5800, balance: 39200, sort_order: 3 });
    expect(row.extra_data).toEqual({});
  });

  it('treats {} and missing extraData as equal (no spurious update)', () => {
    const a = toTransactionRow(tx, 0);
    const b = toTransactionRow({ ...tx, extraData: {} }, 0);
    const { add, update, skip } = classifyRows([a], [b], 'id', TX_KEYS);
    expect([add.length, update.length, skip.length]).toEqual([0, 0, 1]);
  });

  it('classifies add / update / skip and is idempotent', () => {
    const rows = [toTransactionRow(tx, 0), toTransactionRow({ ...tx, id: 'tx-2' }, 1)];
    const first = classifyRows(rows, [], 'id', TX_KEYS);
    expect(first.add).toHaveLength(2);
    const changed = [{ ...rows[0], amount: 1 }, rows[1]];
    const second = classifyRows(rows, changed, 'id', TX_KEYS);
    expect([second.add.length, second.update.length, second.skip.length]).toEqual([0, 1, 1]);
    expect(classifyRows(rows, rows, 'id', TX_KEYS).skip).toHaveLength(2);
  });

  it('maps categories and the menu-visibility setting', () => {
    expect(toCategoryRow({ id: 'snack', label: '간식', matchKeywords: ['간식'] }, 1).match_keywords).toEqual(['간식']);
    expect(CAT_KEYS).toContain('label');
    expect(toSettingRows({ viewerMenuVisibility: { ledger: true } })).toEqual([
      { key: 'viewer_menu_visibility', value: { ledger: true } },
    ]);
    expect(toSettingRows({})).toEqual([]);
  });

  it('blocks duplicate ids, bad dates and non-integer amounts', () => {
    const bad = { transactions: [tx, { ...tx }, { ...tx, id: 'x', date: '2026/10/02', amount: 1.5 }] };
    const problems = validateSnapshot(bad);
    expect(problems.some((p) => p.includes('id 중복'))).toBe(true);
    expect(problems.some((p) => p.includes('date 형식'))).toBe(true);
    expect(problems.some((p) => p.includes('amount'))).toBe(true);
    expect(validateSnapshot({ transactions: [tx] })).toEqual([]);
  });

  it('summarizes per month with last balance', () => {
    const rows = [toTransactionRow(tx, 0), toTransactionRow({ ...tx, id: 'b', amount: 200, balance: 1 }, 1)];
    expect(summarize(rows).months['2026-10']).toEqual({ count: 2, sum: 6000, lastBalance: 1 });
  });
});
