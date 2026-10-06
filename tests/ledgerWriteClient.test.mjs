import { describe, expect, it, vi } from 'vitest';
import { resolveLedgerWriteSource } from '../src/utils/ledgerWriteSource.js';
import {
  LedgerClientError,
  createLedgerApi,
  describeLedgerClientError,
} from '../src/utils/ledgerApiClient.js';
import { planLedgerChanges, stripLedgerMeta, txPersistKey } from '../src/utils/ledgerDiff.js';
import { applyLedgerPlan, describeCounts } from '../src/utils/ledgerPlanRunner.js';
import { classifyLegacyDraft } from '../src/utils/ledgerLegacyDraft.js';
import { buildEditDataFromRows, transactionFromRow } from '../src/utils/ledgerSnapshotMapping.js';
import { buildTeamSnapshot } from '../src/utils/publishSnapshot.js';

const tx = (over = {}) => ({
  id: 'a',
  date: '2026-09-03',
  category: '티타임',
  description: 'x',
  amount: 5000,
  balance: 40000,
  paymentMethod: '법인카드',
  attendees: '팀 모두',
  extraData: {},
  _version: 1,
  ...over,
});

describe('resolveLedgerWriteSource', () => {
  it('defaults to blob, follows the env flag, and lets the URL override both ways', () => {
    expect(resolveLedgerWriteSource()).toBe('blob');
    expect(resolveLedgerWriteSource({ envValue: 'true' })).toBe('supabase');
    expect(resolveLedgerWriteSource({ envValue: 'true', search: '?ledgerWrite=blob' })).toBe('blob');
    expect(resolveLedgerWriteSource({ search: '?ledgerWrite=supabase' })).toBe('supabase');
    expect(resolveLedgerWriteSource({ search: '?ledgerWrite=x' })).toBe('blob');
  });
});

describe('planLedgerChanges', () => {
  it('detects add / update / remove and carries versions', () => {
    const prev = [tx({ id: 'a', _version: 3 }), tx({ id: 'b', _version: 2 })];
    const next = [tx({ id: 'a', amount: 9000 }), tx({ id: 'c', _version: undefined })];
    const plan = planLedgerChanges(prev, next);
    expect(plan.adds.map((t) => t.id)).toEqual(['c']);
    expect(plan.updates).toEqual([{ tx: expect.objectContaining({ id: 'a', amount: 9000 }), version: 3 }]);
    expect(plan.removes).toEqual([{ id: 'b', version: 2 }]);
    expect(plan.isEmpty).toBe(false);
  });

  it('ignores balance, _version and {} vs missing extraData', () => {
    const prev = [tx()];
    const next = [{ ...tx({ balance: 1, _version: 99 }), extraData: undefined }];
    expect(planLedgerChanges(prev, next).isEmpty).toBe(true);
    expect(txPersistKey(tx({ extraData: { b: 1, a: 2 } }))).toBe(txPersistKey(tx({ extraData: { a: 2, b: 1 } })));
  });

  it('never sends balance or _version to the server', () => {
    const plan = planLedgerChanges([], [tx()]);
    expect(plan.adds[0]).not.toHaveProperty('balance');
    expect(plan.adds[0]).not.toHaveProperty('_version');
    expect(stripLedgerMeta([tx()])[0]).not.toHaveProperty('_version');
  });

  it('rejects duplicate or missing ids', () => {
    expect(() => planLedgerChanges([], [tx(), tx()])).toThrow('중복');
    expect(() => planLedgerChanges([], [tx({ id: '' })])).toThrow('id');
  });
});

describe('applyLedgerPlan', () => {
  const makeApi = () => ({
    deleteTransaction: vi.fn().mockResolvedValue({}),
    updateTransaction: vi.fn(async (id, t, v) => ({ transaction: { id, version: v + 1 } })),
    createTransaction: vi.fn(async (t) => ({ transaction: { id: t.id, version: 1 } })),
    bulkTransactions: vi.fn().mockResolvedValue({ added: 2 }),
  });

  it('runs deletes, updates and a single add with the right versions', async () => {
    const api = makeApi();
    const plan = planLedgerChanges(
      [tx({ id: 'a', _version: 3 }), tx({ id: 'b', _version: 2 })],
      [tx({ id: 'a', amount: 1 }), tx({ id: 'n', _version: undefined })]
    );
    const versions = new Map();
    const counts = await applyLedgerPlan(api, plan, { versions });
    expect(api.deleteTransaction).toHaveBeenCalledWith('b', 2);
    expect(api.updateTransaction).toHaveBeenCalledWith('a', expect.objectContaining({ amount: 1 }), 3);
    expect(api.createTransaction).toHaveBeenCalledTimes(1);
    expect(counts).toEqual({ added: 1, updated: 1, removed: 1 });
    expect(versions.get('a')).toBe(4);
    expect(describeCounts(counts)).toBe('추가 1 · 수정 1 · 삭제 1');
  });

  it('uses the newest known version so back-to-back edits do not conflict with themselves', async () => {
    const api = makeApi();
    const versions = new Map([['a', 7]]);
    await applyLedgerPlan(api, planLedgerChanges([tx({ id: 'a', _version: 1 })], [tx({ id: 'a', amount: 2 })]), { versions });
    expect(api.updateTransaction).toHaveBeenCalledWith('a', expect.anything(), 7);
  });

  it('sends several adds as one bulk merge and stops on the first failure', async () => {
    const api = makeApi();
    await applyLedgerPlan(api, planLedgerChanges([], [tx({ id: '1' }), tx({ id: '2' })]));
    expect(api.bulkTransactions).toHaveBeenCalledWith(expect.any(Array), { mode: 'merge' });
    expect(api.createTransaction).not.toHaveBeenCalled();

    const failing = makeApi();
    failing.deleteTransaction.mockRejectedValue(new LedgerClientError(409, 'version-conflict', 'x'));
    const plan = planLedgerChanges([tx({ id: 'a' })], [tx({ id: 'n', _version: undefined })]);
    await expect(applyLedgerPlan(failing, plan)).rejects.toBeInstanceOf(LedgerClientError);
    expect(failing.createTransaction).not.toHaveBeenCalled();
  });

  it('refuses to guess a missing version', async () => {
    const api = makeApi();
    const plan = planLedgerChanges([tx({ id: 'a', _version: undefined })], []);
    await expect(applyLedgerPlan(api, plan)).rejects.toThrow('버전');
  });
});

describe('createLedgerApi', () => {
  it('builds the right requests and maps errors', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push([url, init.method, init.body]);
      return url.includes('id=bad')
        ? { ok: false, status: 409, json: async () => ({ error: 'version-conflict', message: 'm', currentVersion: 5 }) }
        : { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    const api = createLedgerApi(fetchImpl);
    await api.updateTransaction('a', { id: 'a' }, 2);
    await api.deleteTransaction('a', 2);
    expect(calls[0][0]).toBe('/api/ledger-snapshot?resource=transactions&id=a');
    expect(calls[0][1]).toBe('PATCH');
    expect(JSON.parse(calls[0][2])).toEqual({ transaction: { id: 'a' }, expectedVersion: 2 });
    expect(calls[1][0]).toBe('/api/ledger-snapshot?resource=transactions&id=a&expectedVersion=2');
    await expect(api.updateTransaction('bad', {}, 1)).rejects.toMatchObject({ status: 409, code: 'version-conflict', currentVersion: 5 });
  });

  it('turns network failures and statuses into friendly Korean messages', async () => {
    const api = createLedgerApi(async () => {
      throw new Error('offline');
    });
    await expect(api.createTransaction({})).rejects.toMatchObject({ code: 'network' });
    expect(describeLedgerClientError(new LedgerClientError(403, 'forbidden', 'm'))).toContain('로그인');
    expect(describeLedgerClientError(new LedgerClientError(409, 'version-conflict', 'm'))).toContain('다른 곳에서 먼저');
    expect(describeLedgerClientError(new LedgerClientError(501, 'supabase-not-configured', 'm'))).toContain('설정');
  });
});

describe('classifyLegacyDraft', () => {
  const server = [tx({ id: 'a' }), tx({ id: 'b' })];
  it('is none for an empty draft and identical when nothing differs', () => {
    expect(classifyLegacyDraft(server, null).status).toBe('none');
    expect(classifyLegacyDraft(server, []).status).toBe('none');
    expect(classifyLegacyDraft(server, [tx({ id: 'a', balance: 1, extraData: undefined })]).status).toBe('identical');
  });
  it('is diverged when the draft has local-only or edited rows', () => {
    const r = classifyLegacyDraft(server, [tx({ id: 'a', amount: 1 }), tx({ id: 'zzz' })]);
    expect(r).toMatchObject({ status: 'diverged', onlyLocal: 1, differing: 1, total: 2 });
  });
});

describe('mapping and backups', () => {
  it('carries _version only for the editor and strips it from backups', () => {
    const row = { id: 'a', tx_date: '2026-09-03', category: 'c', description: 'd', amount: 1, balance: 2, version: 4, extra_data: {} };
    expect(transactionFromRow(row)._version).toBeUndefined();
    expect(transactionFromRow(row, { withVersion: true })._version).toBe(4);
    const edit = buildEditDataFromRows({
      transactions: [{ ...row, updated_at: '2026-10-06T00:00:00Z' }],
      settings: [{ key: 'viewer_menu_visibility', value: { ledger: true }, version: 3, updated_at: '2026-10-06T00:00:00Z' }],
    });
    expect(edit).toMatchObject({ menuVisibility: { ledger: true }, menuVersion: 3 });
    expect(edit.transactions[0]._version).toBe(4);
    const snap = buildTeamSnapshot(edit.transactions, [], null);
    expect(snap.transactions[0]).not.toHaveProperty('_version');
    expect(snap.transactions[0].balance).toBe(2);
  });
});
