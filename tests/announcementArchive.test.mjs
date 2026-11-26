import { beforeEach, describe, expect, it } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleAnnouncementArchive } from '../server/api-utils/announcementArchive.js';
import { isArchiveCandidate, isRestorable, sanitizeIds } from '../src/utils/announcementArchive.js';
import { describeArchivePreview } from '../src/utils/announcementArchiveApi.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

const NOW = new Date('2026-11-26T00:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
const row = (id, extra = {}) => ({
  id,
  title: `공지 ${id}`,
  category: 'notice',
  is_pinned: false,
  is_published: true,
  published_at: daysAgo(120),
  ...extra,
});

describe('announcement archive rules', () => {
  it('archives only published, unpinned, 90+ day old announcements', () => {
    expect(isArchiveCandidate(row('a'), NOW)).toBe(true);
    expect(isArchiveCandidate(row('a', { published_at: daysAgo(89) }), NOW)).toBe(false);
    expect(isArchiveCandidate(row('a', { is_pinned: true }), NOW)).toBe(false);
    expect(isArchiveCandidate(row('a', { is_published: false }), NOW)).toBe(false);
    expect(isArchiveCandidate(row('a', { published_at: null }), NOW)).toBe(false);
  });

  it('restores only previously published (not draft) announcements', () => {
    expect(isRestorable(row('a', { is_published: false }))).toBe(true);
    expect(isRestorable(row('a', { is_published: false, published_at: null }))).toBe(false);
    expect(isRestorable(row('a'))).toBe(false);
  });

  it('validates ids', () => {
    expect(sanitizeIds(['a', 'a', ' b '])).toEqual(['a', 'b']);
    expect(sanitizeIds([])).toBeNull();
    expect(sanitizeIds('a')).toBeNull();
    expect(sanitizeIds(Array.from({ length: 201 }, (_, i) => `id${i}`))).toBeNull();
  });

  it('describes the preview, including the empty case', () => {
    expect(describeArchivePreview({ days: 90, items: [] })[0]).toContain('없습니다');
    const lines = describeArchivePreview({
      days: 90,
      items: Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, title: `t${i}`, publishedAt: daysAgo(100) })),
    });
    expect(lines[0]).toContain('10건');
    expect(lines.join('\n')).toContain('외 2건');
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
async function call(db, req) {
  const res = createRes();
  await handleAnnouncementArchive({ headers: {}, ...req }, res, db);
  return res;
}

describe('announcement archive API', () => {
  let db;
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    db = makeFakeSupabase({
      announcements: [
        row('old1'),
        row('old2', { published_at: daysAgo(200) }),
        row('new1', { published_at: daysAgo(10) }),
        row('pinned', { is_pinned: true }),
        row('draft', { is_published: false, published_at: null }),
      ],
    });
  });

  it('rejects callers without an admin session and writes nothing', async () => {
    for (const headers of [{}, { referer: `${ORIGIN}/admin` }, { referer: `${ORIGIN}/wschoi`, cookie: adminHeaders().cookie }]) {
      for (const req of [{ method: 'GET' }, { method: 'POST', body: { action: 'archive', ids: ['old1'] } }]) {
        const res = await call(db, { ...req, headers });
        expect(res.statusCode).toBe(403);
      }
    }
    expect(db.log).toHaveLength(0);
  });

  it('previews candidates without changing anything', async () => {
    const res = await call(db, { method: 'GET', headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.items.map((i) => i.id)).toEqual(['old2', 'old1']);
    expect(db.log.every((l) => l.op === 'select')).toBe(true);
  });

  it('archives only still-eligible ids and never touches other fields or rows', async () => {
    const res = await call(db, {
      method: 'POST',
      headers: adminHeaders(),
      body: { action: 'archive', ids: ['old1', 'new1', 'pinned', 'draft', 'missing'] },
    });
    expect(res.body.data.changedIds).toEqual(['old1']);
    expect(res.body.data.skipped).toBe(4);
    const byId = Object.fromEntries(db.tables.announcements.map((r) => [r.id, r]));
    expect(byId.old1.is_published).toBe(false);
    expect(byId.old1.title).toBe('공지 old1'); // 다른 칸은 그대로
    expect(byId.old2.is_published).toBe(true);
    expect(byId.new1.is_published).toBe(true);
    expect(byId.pinned.is_published).toBe(true);
    expect(db.tables.announcements).toHaveLength(5); // 삭제 없음
    expect(db.log.filter((l) => l.op === 'update').every((l) => Object.keys(l.payload).join() === 'is_published')).toBe(true);
    expect(db.log.some((l) => l.op === 'delete')).toBe(false);
  });

  it('restores what was archived, but never publishes a draft', async () => {
    await call(db, { method: 'POST', headers: adminHeaders(), body: { action: 'archive', ids: ['old1', 'old2'] } });
    const res = await call(db, {
      method: 'POST',
      headers: adminHeaders(),
      body: { action: 'restore', ids: ['old1', 'old2', 'draft'] },
    });
    expect(res.body.data.changedIds.sort()).toEqual(['old1', 'old2']);
    const byId = Object.fromEntries(db.tables.announcements.map((r) => [r.id, r]));
    expect(byId.old1.is_published).toBe(true);
    expect(byId.old2.is_published).toBe(true);
    expect(byId.draft.is_published).toBe(false);
  });

  it('rejects bad requests', async () => {
    for (const body of [{}, { action: 'archive' }, { action: 'delete', ids: ['a'] }, { action: 'archive', ids: [] }]) {
      const res = await call(db, { method: 'POST', headers: adminHeaders(), body });
      expect(res.statusCode).toBe(400);
    }
    const res = await call(db, { method: 'DELETE', headers: adminHeaders() });
    expect(res.statusCode).toBe(405);
    expect(db.log.some((l) => l.op !== 'select')).toBe(false);
  });
});
