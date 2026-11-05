/**
 * 참고문서 '강의 가이드' 숨김/복구 (관리자 전용, service role).
 * 읽기는 브라우저가 anon 으로 직접 한다. 파일은 삭제하지 않고 숨김 목록(doc_id)만 기록한다.
 */
import { canUseAdminWrite } from './adminWriteGuard.js';
import { parseQuery, readJsonBody } from './announcementEngagement.js';
import { REFERENCE_DOCS } from '../../src/constants/referenceDocs.js';

const TABLE = 'reference_doc_hidden';
const HIDEABLE_IDS = new Set(REFERENCE_DOCS.filter((d) => d.category === 'lecture' && d.format === 'html').map((d) => d.id));

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function handleReferenceDocsAdmin(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return json(res, 403, { ok: false, status: 'forbidden', message: '관리자 화면에서만 문서를 숨기거나 복구할 수 있습니다.' });
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const docId = String(body?.docId || '').trim();
    if (!HIDEABLE_IDS.has(docId)) {
      return json(res, 400, { ok: false, status: 'error', message: '숨길 수 있는 강의 가이드가 아닙니다.' });
    }
    const { error } = await client.from(TABLE).upsert([{ doc_id: docId }], { onConflict: 'doc_id' });
    if (error) return json(res, 500, { ok: false, status: 'error', message: error.message });
    return json(res, 200, { ok: true, status: 'ok', data: { docId } });
  }

  if (req.method === 'DELETE') {
    const docId = String(parseQuery(req).docId || '').trim();
    if (!HIDEABLE_IDS.has(docId)) {
      return json(res, 400, { ok: false, status: 'error', message: '복구할 수 있는 강의 가이드가 아닙니다.' });
    }
    const { error } = await client.from(TABLE).delete().eq('doc_id', docId);
    if (error) return json(res, 500, { ok: false, status: 'error', message: error.message });
    return json(res, 200, { ok: true, status: 'ok', data: { docId } });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return json(res, 405, { ok: false, status: 'error', message: 'method not allowed' });
}
