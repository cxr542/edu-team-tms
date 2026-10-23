import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleGlossaryAdmin } from '../server/api-utils/glossaryAdmin.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

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
  await handleGlossaryAdmin({ headers: {}, ...req }, res, db);
  return res;
}

const term = (over = {}) => ({
  id: 'vm-ware',
  slug: 'vm-ware',
  title: 'VMware',
  category: 'topic',
  tags: ['cloud'],
  body: '# VMware',
  related: ['vvf'],
  sourceUrl: null,
  ...over,
});

describe('glossary admin API', () => {
  let db;
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    db = makeFakeSupabase({ glossary_terms: [] });
  });

  it('rejects writes without an admin session, from member routes or foreign origins — and never touches the DB', async () => {
    const bodies = { body: { term: term() } };
    for (const headers of [
      { referer: `${ORIGIN}/admin` },
      { referer: `${ORIGIN}/wschoi?module=glossary`, cookie: createAdminSessionCookie().split(';')[0] },
      { referer: 'https://evil.example/admin', cookie: createAdminSessionCookie().split(';')[0] },
      {},
    ]) {
      const res = await call(db, { method: 'PUT', headers, ...bodies });
      expect(res.statusCode).toBe(403);
      expect(res.body.status).toBe('forbidden');
    }
    const del = await call(db, { method: 'DELETE', headers: { referer: `${ORIGIN}/admin` }, url: '/api/glossary-admin?slug=x' });
    expect(del.statusCode).toBe(403);
    expect(db.log).toHaveLength(0);
  });

  it('upserts one term using the real production columns (markdown, related_terms, source never null)', async () => {
    const res = await call(db, { method: 'PUT', headers: adminHeaders(), body: { term: term() } });
    expect(res.statusCode).toBe(200);
    expect(res.body.data[0]).toMatchObject({ slug: 'vm-ware', title: 'VMware', body: '# VMware' });
    const row = db.tables.glossary_terms[0];
    expect(row).toMatchObject({ slug: 'vm-ware', markdown: '# VMware', related_terms: ['vvf'], source: '' });
    expect(row).not.toHaveProperty('body');
    expect(row).not.toHaveProperty('visibility');
  });

  it('updates an existing slug in place (upsert on slug) instead of duplicating it', async () => {
    await call(db, { method: 'PUT', headers: adminHeaders(), body: { term: term() } });
    await call(db, { method: 'PUT', headers: adminHeaders(), body: { term: term({ title: 'VMware vSphere' }) } });
    expect(db.tables.glossary_terms).toHaveLength(1);
    expect(db.tables.glossary_terms[0].title).toBe('VMware vSphere');
  });

  it('saves a batch and validates before writing anything', async () => {
    const ok = await call(db, {
      method: 'PUT',
      headers: adminHeaders(),
      body: { terms: [term({ slug: 'a', id: 'a' }), term({ slug: 'b', id: 'b', title: 'B' })] },
    });
    expect(ok.statusCode).toBe(200);
    expect(db.tables.glossary_terms.map((r) => r.slug)).toEqual(['a', 'b']);

    const before = db.tables.glossary_terms.length;
    for (const body of [
      { terms: [term({ slug: 'c', id: 'c' }), term({ slug: 'd', id: 'd', title: '' })] },
      { terms: [term({ slug: 'dup', id: 'dup' }), term({ slug: 'dup', id: 'dup2' })] },
      { terms: [] },
      {},
      { terms: Array.from({ length: 201 }, (_, i) => term({ slug: `s${i}`, id: `s${i}` })) },
    ]) {
      const bad = await call(db, { method: 'PUT', headers: adminHeaders(), body });
      expect(bad.statusCode).toBe(400);
    }
    expect(db.tables.glossary_terms).toHaveLength(before);
  });

  it('deletes exactly one slug and refuses a missing slug', async () => {
    await call(db, { method: 'PUT', headers: adminHeaders(), body: { terms: [term({ slug: 'a', id: 'a' }), term({ slug: 'b', id: 'b' })] } });
    const res = await call(db, { method: 'DELETE', headers: adminHeaders(), url: '/api/glossary-admin?slug=a' });
    expect(res.statusCode).toBe(200);
    expect(db.tables.glossary_terms.map((r) => r.slug)).toEqual(['b']);
    const missing = await call(db, { method: 'DELETE', headers: adminHeaders(), url: '/api/glossary-admin' });
    expect(missing.statusCode).toBe(400);
    expect(db.tables.glossary_terms).toHaveLength(1);
  });

  it('answers 405 for other methods and 500 when the database errors', async () => {
    const post = await call(db, { method: 'POST', headers: adminHeaders(), body: { term: term() } });
    expect(post.statusCode).toBe(405);
    const failing = { from: () => ({ upsert: () => ({ select: async () => ({ data: null, error: { message: 'boom' } }) }) }) };
    const res = await call(failing, { method: 'PUT', headers: adminHeaders(), body: { term: term() } });
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('boom');
  });
});

describe('announcements dispatcher', () => {
  it('routes /api/glossary-admin to the glossary handler', async () => {
    vi.resetModules();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    const fake = makeFakeSupabase({ glossary_terms: [] });
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => fake }));
    const handler = (await import('../api/announcements.js')).default;
    const res = createRes();
    await handler(
      { method: 'PUT', url: '/api/glossary-admin', headers: adminHeaders(), body: { term: term() } },
      res
    );
    vi.doUnmock('@supabase/supabase-js');
    expect(res.statusCode).toBe(200);
    expect(fake.tables.glossary_terms).toHaveLength(1);
  });
});
