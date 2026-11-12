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

  describe('editing an uploaded guide', () => {
    const seed = () =>
      db.tables.reference_doc_uploads.push({
        id: 'lecture-u-abc',
        title: '원래 제목',
        grp: 'CONTRABASS 3.0.6',
        summary: '',
        html: '<h1>v1</h1><p>10.0.0.5</p>',
        size_bytes: 25,
      });
    const post = (body) => call(db, { method: 'POST', headers: adminHeaders(), body });

    it('rejects edits without an admin session', async () => {
      seed();
      const res = await call(db, { method: 'POST', headers: {}, body: { docId: 'lecture-u-abc', title: 'x' } });
      expect(res.statusCode).toBe(403);
      expect(db.tables.reference_doc_uploads[0].title).toBe('원래 제목');
    });

    it('rejects static or unknown ids', async () => {
      seed();
      expect((await post({ docId: 'lecture-hpa-306', title: 'x' })).statusCode).toBe(400);
      expect((await post({ docId: 'lecture-u-nope', title: 'x' })).statusCode).toBe(400);
    });

    it('updates metadata only without touching the saved body', async () => {
      seed();
      const res = await post({ docId: 'lecture-u-abc', title: '새 제목', group: 'VIOLA 3.0.6', summary: '요약' });
      expect(res.statusCode).toBe(200);
      const [row] = db.tables.reference_doc_uploads;
      expect(row).toMatchObject({ title: '새 제목', grp: 'VIOLA 3.0.6', summary: '요약', html: '<h1>v1</h1><p>10.0.0.5</p>' });
      expect(row.prev_html).toBeUndefined();
    });

    it('re-sanitizes and masks an edited body and keeps the previous one', async () => {
      seed();
      const res = await post({ docId: 'lecture-u-abc', html: '<h1>v2</h1><script>x()</script><p>192.168.1.7</p>' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.hasPrevious).toBe(true);
      const [row] = db.tables.reference_doc_uploads;
      expect(row.html).not.toMatch(/script|192\.168/);
      expect(row.html).toContain('198.18.0.7');
      expect(row.prev_html).toBe('<h1>v1</h1><p>10.0.0.5</p>');
    });

    it('rejects empty, non-html and oversized bodies', async () => {
      seed();
      expect((await post({ docId: 'lecture-u-abc', html: '   ' })).statusCode).toBe(400);
      expect((await post({ docId: 'lecture-u-abc', html: 'plain text' })).statusCode).toBe(400);
      expect((await post({ docId: 'lecture-u-abc', html: `<p>${'a'.repeat(4 * 1024 * 1024)}</p>` })).statusCode).toBe(400);
      expect(db.tables.reference_doc_uploads[0].html).toBe('<h1>v1</h1><p>10.0.0.5</p>');
    });

    it('reverts by swapping with the previous body, and reverting again restores it', async () => {
      seed();
      expect((await post({ docId: 'lecture-u-abc', action: 'revert' })).statusCode).toBe(400);
      await post({ docId: 'lecture-u-abc', html: '<h1>v2</h1><p>new</p>' });
      const back = await post({ docId: 'lecture-u-abc', action: 'revert' });
      expect(back.statusCode).toBe(200);
      expect(db.tables.reference_doc_uploads[0].html).toBe('<h1>v1</h1><p>10.0.0.5</p>');
      await post({ docId: 'lecture-u-abc', action: 'revert' });
      expect(db.tables.reference_doc_uploads[0].html).toBe('<h1>v2</h1><p>new</p>');
    });
  });

  describe('member submissions', () => {
    const memberHeaders = { referer: `${ORIGIN}/yhkim` };
    const submit = (body, headers = memberHeaders) =>
      call(db, { method: 'POST', headers, body: { submit: true, ...body } });
    const good = { title: '제출 가이드', group: 'VIOLA 3.0.6', html: '<h1>t</h1><p>10.1.2.3</p><script>x()</script>', submitter: '김구성' };

    beforeEach(() => {
      db.tables.reference_doc_submissions = [];
    });

    it('accepts a member submission without an admin session, into the pending table only', async () => {
      const res = await submit(good);
      expect(res.statusCode).toBe(200);
      expect(db.tables.reference_doc_uploads).toHaveLength(0);
      const [row] = db.tables.reference_doc_submissions;
      expect(row).toMatchObject({ title: '제출 가이드', grp: 'VIOLA 3.0.6', submitter: '김구성' });
      expect(row.html).not.toMatch(/script|10\.1\.2\.3/);
      expect(row.id.startsWith('sub-')).toBe(true);
    });

    it('rejects submissions from other origins and invalid payloads', async () => {
      expect((await submit(good, { referer: 'https://evil.example.com/x' })).statusCode).toBe(403);
      expect((await submit(good, {})).statusCode).toBe(403);
      expect((await submit({ ...good, title: '' })).statusCode).toBe(400);
      expect((await submit({ ...good, html: 'plain' })).statusCode).toBe(400);
      expect((await submit({ ...good, html: `<p>${'a'.repeat(4 * 1024 * 1024)}</p>` })).statusCode).toBe(400);
      expect(db.tables.reference_doc_submissions).toHaveLength(0);
    });

    it('stops accepting once too many are pending', async () => {
      for (let i = 0; i < 50; i += 1) {
        db.tables.reference_doc_submissions.push({ id: `sub-${i}`, title: 't', grp: 'g', html: '<p>x</p>' });
      }
      expect((await submit(good)).statusCode).toBe(400);
    });

    it('keeps admin-only actions closed to members', async () => {
      db.tables.reference_doc_submissions.push({ id: 'sub-1', title: 't', grp: 'g', html: '<p>x</p>' });
      expect((await call(db, { method: 'GET', headers: memberHeaders, url: '/api/reference-docs-admin' })).statusCode).toBe(403);
      expect((await call(db, { method: 'POST', headers: memberHeaders, body: { action: 'approve', submissionId: 'sub-1' } })).statusCode).toBe(403);
      expect((await call(db, { method: 'DELETE', headers: memberHeaders, url: '/api/reference-docs-admin?submissionId=sub-1' })).statusCode).toBe(403);
      expect(db.tables.reference_doc_submissions).toHaveLength(1);
      expect(db.tables.reference_doc_uploads).toHaveLength(0);
    });

    it('lets an admin list, preview, approve and reject', async () => {
      await submit(good);
      await submit({ ...good, title: '두 번째' });
      const list = await call(db, { method: 'GET', headers: adminHeaders(), url: '/api/reference-docs-admin' });
      expect(list.statusCode).toBe(200);
      expect(list.body.data.map((r) => r.title)).toEqual(['제출 가이드', '두 번째']);
      expect(list.body.data[0]).not.toHaveProperty('html');
      const [first, second] = list.body.data;

      const preview = await call(db, {
        method: 'GET',
        headers: adminHeaders(),
        url: `/api/reference-docs-admin?submissionId=${first.id}`,
      });
      expect(preview.body.data.html).toContain('<h1>t</h1>');

      const approve = await call(db, {
        method: 'POST',
        headers: adminHeaders(),
        body: { action: 'approve', submissionId: first.id, title: '승인된 제목' },
      });
      expect(approve.statusCode).toBe(200);
      expect(db.tables.reference_doc_uploads).toHaveLength(1);
      expect(db.tables.reference_doc_uploads[0]).toMatchObject({ title: '승인된 제목', grp: 'VIOLA 3.0.6' });
      expect(db.tables.reference_doc_submissions.map((r) => r.id)).toEqual([second.id]);

      const reject = await call(db, {
        method: 'DELETE',
        headers: adminHeaders(),
        url: `/api/reference-docs-admin?submissionId=${second.id}`,
      });
      expect(reject.statusCode).toBe(200);
      expect(db.tables.reference_doc_submissions).toHaveLength(0);
      expect(db.tables.reference_doc_uploads).toHaveLength(1);
    });

    it('stores research submissions with the research group and normalized tags, and keeps them on approve', async () => {
      const res = await submit({ ...good, group: '', category: 'research', tags: 'AWS, #aws, 경쟁사 ' });
      expect(res.statusCode).toBe(200);
      const [row] = db.tables.reference_doc_submissions;
      expect(row).toMatchObject({ category: 'research', grp: '리서치 자료', tags: ['AWS', '경쟁사'] });

      const list = await call(db, { method: 'GET', headers: adminHeaders(), url: '/api/reference-docs-admin' });
      expect(list.body.data[0]).toMatchObject({ category: 'research', tags: ['AWS', '경쟁사'] });

      await call(db, { method: 'POST', headers: adminHeaders(), body: { action: 'approve', submissionId: row.id } });
      expect(db.tables.reference_doc_uploads[0]).toMatchObject({ category: 'research', grp: '리서치 자료', tags: ['AWS', '경쟁사'] });
    });

    it('lecture submissions without tags send no category/tags columns (works before the SQL is run)', async () => {
      await submit(good);
      const [row] = db.tables.reference_doc_submissions;
      expect(row).not.toHaveProperty('category');
      expect(row).not.toHaveProperty('tags');
    });
  });

  it('admin upload accepts research category and ignores unknown categories', async () => {
    const post = (body) => call(db, { method: 'POST', headers: adminHeaders(), body });
    expect((await post({ title: 'r', category: 'research', html: '<p>x</p>' })).statusCode).toBe(200);
    expect(db.tables.reference_doc_uploads[0]).toMatchObject({ category: 'research', grp: '리서치 자료', tags: [] });
    expect((await post({ title: 'l', group: 'g', category: 'bogus', tags: ['a'], html: '<p>x</p>' })).statusCode).toBe(200);
    expect(db.tables.reference_doc_uploads[1]).toMatchObject({ category: 'lecture', grp: 'g', tags: ['a'] });
  });
});
