/**
 * 참고문서 '강의 가이드' 관리자 쓰기 (service role).
 *  - PUT/DELETE ?docId=  : 숨김/복구 (파일은 그대로, 숨김 목록만 기록)
 *  - POST                : HTML 업로드 (서버에서 정화·마스킹을 다시 적용한 뒤 저장)
 *  - POST {docId, ...}   : 업로드본 수정 (제목·그룹·요약·본문). 본문을 바꾸면 이전 본문 1개를 보관한다
 *  - POST {docId, action:'revert'} : 보관해 둔 이전 본문과 현재 본문을 맞바꾼다 (되돌리기도 되돌릴 수 있다)
 *  - DELETE ?docId=&purge=1 : 업로드본 완전 삭제 (저장소에 포함된 가이드는 삭제 불가)
 * 읽기는 브라우저가 anon 으로 직접 한다.
 */
import { canUseAdminWrite } from './adminWriteGuard.js';
import { parseQuery, readJsonBody } from './announcementEngagement.js';
import { REFERENCE_DOCS } from '../../src/constants/referenceDocs.js';
import { MAX_GUIDE_HTML_BYTES, processGuideHtml } from '../../src/utils/lectureGuideSanitize.js';

const HIDDEN_TABLE = 'reference_doc_hidden';
const UPLOAD_TABLE = 'reference_doc_uploads';
const STATIC_IDS = new Set(REFERENCE_DOCS.filter((d) => d.category === 'lecture' && d.format === 'html').map((d) => d.id));
export const UPLOAD_ID_PREFIX = 'lecture-u-';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const fail = (res, status, message) => json(res, status, { ok: false, status: 'error', message });

async function isUploadedId(client, docId) {
  if (!docId.startsWith(UPLOAD_ID_PREFIX)) return false;
  const { data, error } = await client.from(UPLOAD_TABLE).select('id').eq('id', docId);
  return !error && Array.isArray(data) && data.length > 0;
}

async function isHideable(client, docId) {
  return STATIC_IDS.has(docId) || (await isUploadedId(client, docId));
}

function newUploadId() {
  return `${UPLOAD_ID_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function handleUpload(req, res, client, body) {
  const title = String(body?.title || '').trim().slice(0, 120);
  const group = String(body?.group || '').trim().slice(0, 40);
  const summary = String(body?.summary || '').trim().slice(0, 200);
  const rawHtml = typeof body?.html === 'string' ? body.html : '';
  if (!title || !group) return fail(res, 400, '제목과 그룹을 입력해 주세요.');
  const invalid = validateHtml(rawHtml);
  if (invalid) return fail(res, 400, invalid);

  const processed = processGuideHtml(rawHtml, { extraDomains: body?.extraDomains });
  if (processed.sizeBytes > MAX_GUIDE_HTML_BYTES) return fail(res, 400, sizeError());

  const id = newUploadId();
  const { error } = await client.from(UPLOAD_TABLE).insert([
    { id, title, grp: group, summary, html: processed.html, size_bytes: processed.sizeBytes },
  ]);
  if (error) return fail(res, 500, error.message);
  return json(res, 200, {
    ok: true,
    status: 'ok',
    data: {
      id,
      sizeBytes: processed.sizeBytes,
      removed: processed.sanitize,
      masked: processed.changes.reduce((n, c) => n + c.count, 0),
    },
  });
}

function validateHtml(rawHtml) {
  if (!rawHtml.trim()) return 'HTML 내용이 비어 있습니다.';
  if (!/<(html|body|h1|h2|p|div|table)\b/i.test(rawHtml)) return 'HTML 문서로 보이지 않습니다.';
  return '';
}

const sizeError = () =>
  `HTML 크기는 ${Math.floor(MAX_GUIDE_HTML_BYTES / 1024 / 1024)}MB 이하여야 합니다. (이미지 용량을 줄여 주세요)`;

async function handleUpdate(req, res, client, body) {
  const docId = String(body.docId || '').trim();
  if (!(await isUploadedId(client, docId))) return fail(res, 400, '업로드한 가이드만 수정할 수 있습니다.');
  const { data: rows, error: readError } = await client
    .from(UPLOAD_TABLE)
    .select('id, html, size_bytes, prev_html, prev_size_bytes')
    .eq('id', docId);
  if (readError || !rows?.[0]) return fail(res, 500, readError?.message || '가이드를 불러오지 못했습니다.');
  const cur = rows[0];
  const patch = { updated_at: new Date().toISOString() };

  if (body.action === 'revert') {
    if (!cur.prev_html) return fail(res, 400, '되돌릴 이전 버전이 없습니다.');
    Object.assign(patch, {
      html: cur.prev_html,
      size_bytes: cur.prev_size_bytes,
      prev_html: cur.html,
      prev_size_bytes: cur.size_bytes,
    });
  } else {
    if (body.title !== undefined) {
      const title = String(body.title || '').trim().slice(0, 120);
      if (!title) return fail(res, 400, '제목을 입력해 주세요.');
      patch.title = title;
    }
    if (body.group !== undefined) {
      const group = String(body.group || '').trim().slice(0, 40);
      if (!group) return fail(res, 400, '그룹을 입력해 주세요.');
      patch.grp = group;
    }
    if (body.summary !== undefined) patch.summary = String(body.summary || '').trim().slice(0, 200);
    if (body.html !== undefined) {
      const rawHtml = typeof body.html === 'string' ? body.html : '';
      const invalid = validateHtml(rawHtml);
      if (invalid) return fail(res, 400, invalid);
      const processed = processGuideHtml(rawHtml, { extraDomains: body.extraDomains });
      if (processed.sizeBytes > MAX_GUIDE_HTML_BYTES) return fail(res, 400, sizeError());
      if (processed.html !== cur.html) {
        Object.assign(patch, {
          html: processed.html,
          size_bytes: processed.sizeBytes,
          prev_html: cur.html,
          prev_size_bytes: cur.size_bytes,
        });
      }
    }
  }

  const { error } = await client.from(UPLOAD_TABLE).update(patch).eq('id', docId);
  if (error) return fail(res, 500, error.message);
  return json(res, 200, {
    ok: true,
    status: 'ok',
    data: { id: docId, sizeBytes: patch.size_bytes ?? cur.size_bytes, hasPrevious: Boolean(patch.prev_html ?? cur.prev_html) },
  });
}

export async function handleReferenceDocsAdmin(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return json(res, 403, { ok: false, status: 'forbidden', message: '관리자 화면에서만 가이드를 관리할 수 있습니다.' });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body?.docId) return handleUpdate(req, res, client, body);
    return handleUpload(req, res, client, body);
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const docId = String(body?.docId || '').trim();
    if (!(await isHideable(client, docId))) return fail(res, 400, '숨길 수 있는 강의 가이드가 아닙니다.');
    const { error } = await client.from(HIDDEN_TABLE).upsert([{ doc_id: docId }], { onConflict: 'doc_id' });
    if (error) return fail(res, 500, error.message);
    return json(res, 200, { ok: true, status: 'ok', data: { docId } });
  }

  if (req.method === 'DELETE') {
    const query = parseQuery(req);
    const docId = String(query.docId || '').trim();
    if (String(query.purge || '') === '1') {
      if (!(await isUploadedId(client, docId))) return fail(res, 400, '업로드한 가이드만 삭제할 수 있습니다.');
      const del = await client.from(UPLOAD_TABLE).delete().eq('id', docId);
      if (del.error) return fail(res, 500, del.error.message);
      await client.from(HIDDEN_TABLE).delete().eq('doc_id', docId);
      return json(res, 200, { ok: true, status: 'ok', data: { docId } });
    }
    if (!(await isHideable(client, docId))) return fail(res, 400, '복구할 수 있는 강의 가이드가 아닙니다.');
    const { error } = await client.from(HIDDEN_TABLE).delete().eq('doc_id', docId);
    if (error) return fail(res, 500, error.message);
    return json(res, 200, { ok: true, status: 'ok', data: { docId } });
  }

  res.setHeader('Allow', 'POST, PUT, DELETE');
  return fail(res, 405, 'method not allowed');
}
