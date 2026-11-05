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
    db = makeFakeSupabase({ reference_doc_hidden: [] });
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
});
