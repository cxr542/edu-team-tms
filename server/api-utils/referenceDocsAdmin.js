/**
 * 참고문서 '강의 가이드' 관리자 쓰기 (service role).
 *  - PUT/DELETE ?docId=  : 숨김/복구 (파일은 그대로, 숨김 목록만 기록)
 *  - POST                : HTML 업로드 (서버에서 정화·마스킹을 다시 적용한 뒤 저장)
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

async function handleUpload(req, res, client) {
  const body = await readJsonBody(req);
  const title = String(body?.title || '').trim().slice(0, 120);
  const group = String(body?.group || '').trim().slice(0, 40);
  const summary = String(body?.summary || '').trim().slice(0, 200);
  const rawHtml = typeof body?.html === 'string' ? body.html : '';
  if (!title || !group) return fail(res, 400, '제목과 그룹을 입력해 주세요.');
  if (!rawHtml.trim()) return fail(res, 400, 'HTML 내용이 비어 있습니다.');
  if (!/<(html|body|h1|h2|p|div|table)\b/i.test(rawHtml)) return fail(res, 400, 'HTML 문서로 보이지 않습니다.');

  const processed = processGuideHtml(rawHtml, { extraDomains: body?.extraDomains });
  if (processed.sizeBytes > MAX_GUIDE_HTML_BYTES) {
    return fail(res, 400, `HTML 크기는 ${Math.floor(MAX_GUIDE_HTML_BYTES / 1024 / 1024)}MB 이하여야 합니다. (이미지 용량을 줄여 주세요)`);
  }

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

export async function handleReferenceDocsAdmin(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return json(res, 403, { ok: false, status: 'forbidden', message: '관리자 화면에서만 가이드를 관리할 수 있습니다.' });
  }

  if (req.method === 'POST') return handleUpload(req, res, client);

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
