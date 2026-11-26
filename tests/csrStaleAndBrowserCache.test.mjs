import { beforeEach, describe, expect, it } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleCsrStaleCheck } from '../server/api-utils/csrStaleCheck.js';
import { isStaleCsr } from '../src/utils/csrStale.js';
import { summarizeCsrStaleCheck } from '../src/utils/csrStaleCheckApi.js';
import {
  BROWSER_CACHE_ENTRIES,
  clearCacheEntries,
  listCacheEntries,
  restoreCacheEntries,
} from '../src/utils/browserCache.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

const NOW = new Date('2026-11-26T00:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const csr = (id, extra = {}) => ({
  id,
  title: `요청 ${id}`,
  status: 'received',
  requester: '김',
  created_at: daysAgo(90),
  updated_at: daysAgo(45),
  ...extra,
});

describe('stale CSR rule', () => {
  it('flags only received/in-progress requests untouched for 30+ days', () => {
    expect(isStaleCsr(csr('a'), NOW)).toBe(true);
    expect(isStaleCsr(csr('a', { status: 'inProgress' }), NOW)).toBe(true);
    expect(isStaleCsr(csr('a', { status: 'done' }), NOW)).toBe(false);
    expect(isStaleCsr(csr('a', { status: 'hold' }), NOW)).toBe(false);
    expect(isStaleCsr(csr('a', { updated_at: daysAgo(10) }), NOW)).toBe(false);
  });

  it('summarizes empty and non-empty results', () => {
    expect(summarizeCsrStaleCheck({ days: 30, items: [] }).label).toBe('대상 0건');
    const s = summarizeCsrStaleCheck({ days: 30, items: [{ statusLabel: '접수', title: 't', updatedAt: daysAgo(40) }] });
    expect(s.label).toBe('1건');
  });
});

const ORIGIN = 'https://edu-team-tms-ten.vercel.app';
const adminHeaders = () => ({ referer: `${ORIGIN}/admin`, cookie: createAdminSessionCookie().split(';')[0] });
function createRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(body) {
      this.body = body ? JSON.parse(body) : null;
    },
  };
}

describe('stale CSR check API', () => {
  let db;
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    db = makeFakeSupabase({
      csr_requests: [
        csr('stale1'),
        csr('stale2', { status: 'inProgress', updated_at: daysAgo(100) }),
        csr('fresh', { updated_at: daysAgo(3) }),
        csr('done', { status: 'done' }),
      ],
    });
  });

  it('rejects callers without an admin session and reads nothing', async () => {
    for (const headers of [{}, { referer: `${ORIGIN}/admin` }, { referer: `${ORIGIN}/wschoi`, cookie: adminHeaders().cookie }]) {
      const res = createRes();
      await handleCsrStaleCheck({ method: 'GET', headers }, res, db);
      expect(res.statusCode).toBe(403);
    }
    expect(db.log).toHaveLength(0);
  });

  it('lists stale requests oldest first using reads only', async () => {
    const res = createRes();
    await handleCsrStaleCheck({ method: 'GET', headers: adminHeaders() }, res, db);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.items.map((i) => i.id)).toEqual(['stale2', 'stale1']);
    expect(db.log.every((l) => l.op === 'select')).toBe(true);
  });

  it('only allows GET', async () => {
    const res = createRes();
    await handleCsrStaleCheck({ method: 'POST', headers: adminHeaders() }, res, db);
    expect(res.statusCode).toBe(405);
    expect(db.log).toHaveLength(0);
  });
});

function fakeStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}

describe('browser cache cleanup', () => {
  it('clears only allowlisted cache keys and never operating data', () => {
    const [a, b] = BROWSER_CACHE_ENTRIES;
    const session = fakeStorage({ [a.key]: 'cache-a', [b.key]: 'cache-b', 'tms-weekly-journal-v1': 'session-journal' });
    const local = fakeStorage({ 'tms-weekly-journal-v1': 'journal', 'tms-transactions-v1': 'ledger', [a.key]: 'same-name-in-local' });
    const storages = { session, local };

    expect(listCacheEntries(storages).map((e) => e.key)).toEqual([a.key, b.key]);
    const snapshot = clearCacheEntries(storages);

    expect(snapshot).toHaveLength(2);
    expect(session.keys()).toEqual(['tms-weekly-journal-v1']);
    expect(local.keys().sort()).toEqual([a.key, 'tms-transactions-v1', 'tms-weekly-journal-v1'].sort());
  });

  it('restores the snapshot and ignores keys outside the allowlist', () => {
    const [a] = BROWSER_CACHE_ENTRIES;
    const session = fakeStorage({ [a.key]: 'cache-a' });
    const storages = { session, local: fakeStorage() };
    const snapshot = clearCacheEntries(storages);
    expect(session.getItem(a.key)).toBeNull();

    const restored = restoreCacheEntries(storages, [...snapshot, { storage: 'local', key: 'tms-transactions-v1', value: 'evil' }]);
    expect(restored).toBe(1);
    expect(session.getItem(a.key)).toBe('cache-a');
    expect(storages.local.getItem('tms-transactions-v1')).toBeNull();
  });
});
