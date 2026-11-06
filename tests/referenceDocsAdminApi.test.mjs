import { beforeEach, describe, expect, it } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';
import { handleReferenceDocsAdmin } from '../server/api-utils/referenceDocsAdmin.js';
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
  await handleReferenceDocsAdmin({ headers: {}, ...req }, res, db);
  return res;
}

describe('reference docs admin API', () => {
  let db;
  beforeEach(() => {
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    db = makeFakeSupabase({ reference_doc_hidden: [], reference_doc_uploads: [] });
  });

  it('rejects writes without an admin session and never touches the DB', async () => {
    for (const headers of [{}, { referer: `${ORIGIN}/yhkim` }, { referer: `${ORIGIN}/admin` }]) {
      const res = await call(db, { method: 'PUT', headers, body: { docId: 'lecture-hpa-306' } });
      expect(res.statusCode).toBe(403);
    }
    expect(db.log).toHaveLength(0);
  });

  it('hides and restores a lecture guide as admin', async () => {
    const hide = await call(db, { method: 'PUT', headers: adminHeaders(), body: { docId: 'lecture-hpa-306' } });
    expect(hide.statusCode).toBe(200);
    expect(db.tables.reference_doc_hidden.map((r) => r.doc_id)).toEqual(['lecture-hpa-306']);

    const restore = await call(db, {
      method: 'DELETE',
      headers: adminHeaders(),
      url: '/api/reference-docs-admin?docId=lecture-hpa-306',
    });
    expect(restore.statusCode).toBe(200);
    expect(db.tables.reference_doc_hidden).toHaveLength(0);
  });

  it('refuses ids that are not lecture guides', async () => {
    const res = await call(db, { method: 'PUT', headers: adminHeaders(), body: { docId: 'kpi-definition' } });
    expect(res.statusCode).toBe(400);
    expect(db.tables.reference_doc_hidden).toHaveLength(0);
  });

  it('uploads a guide as admin, re-sanitizing and masking on the server', async () => {
    const html = '<html><body><h1>t</h1><script>x()</script><p>10.255.60.1 console.okestro.cloud</p></body></html>';
    const res = await call(db, {
      method: 'POST',
      headers: adminHeaders(),
      body: { title: '  새 가이드 ', group: 'CONTRABASS', summary: 's', html },
    });
    expect(res.statusCode).toBe(200);
    const [row] = db.tables.reference_doc_uploads;
    expect(row.id.startsWith('lecture-u-')).toBe(true);
    expect(row).toMatchObject({ title: '새 가이드', grp: 'CONTRABASS' });
    expect(row.html).not.toMatch(/<script|10\.255|okestro\.cloud/);
    expect(row.html).toContain('198.18.0.1');
    expect(res.body.data.masked).toBe(2);
  });

  it('rejects non-admin uploads, empty input and oversize html', async () => {
    const ok = { title: 't', group: 'g', html: '<p>x</p>' };
    expect((await call(db, { method: 'POST', headers: {}, body: ok })).statusCode).toBe(403);
    expect((await call(db, { method: 'POST', headers: adminHeaders(), body: { ...ok, title: '' } })).statusCode).toBe(400);
    expect((await call(db, { method: 'POST', headers: adminHeaders(), body: { ...ok, html: 'plain text' } })).statusCode).toBe(400);
    const big = `<p>${'a'.repeat(4 * 1024 * 1024 + 10)}</p>`;
    expect((await call(db, { method: 'POST', headers: adminHeaders(), body: { ...ok, html: big } })).statusCode).toBe(400);
    expect(db.tables.reference_doc_uploads).toHaveLength(0);
  });

  it('hides an uploaded guide and purges it; static guides cannot be purged', async () => {
    db.tables.reference_doc_uploads.push({ id: 'lecture-u-abc', title: 't', grp: 'g', html: '<p>x</p>' });
    expect((await call(db, { method: 'PUT', headers: adminHeaders(), body: { docId: 'lecture-u-abc' } })).statusCode).toBe(200);
    expect(db.tables.reference_doc_hidden).toHaveLength(1);

    const purgeStatic = await call(db, {
      method: 'DELETE',
      headers: adminHeaders(),
      url: '/api/reference-docs-admin?docId=lecture-hpa-306&purge=1',
    });
    expect(purgeStatic.statusCode).toBe(400);

    const purge = await call(db, {
      method: 'DELETE',
      headers: adminHeaders(),
      url: '/api/reference-docs-admin?docId=lecture-u-abc&purge=1',
    });
    expect(purge.statusCode).toBe(200);
    expect(db.tables.reference_doc_uploads).toHaveLength(0);
    expect(db.tables.reference_doc_hidden).toHaveLength(0);
  });
});
