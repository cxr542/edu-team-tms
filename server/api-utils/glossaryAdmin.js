/**
 * 용어사전 관리자 쓰기 (service role). 등록·수정(upsert, slug 기준)·삭제만 처리한다.
 * 읽기는 브라우저가 anon 으로 직접 한다. 인증은 canUseAdminWrite(관리자 세션).
 */
import { canUseAdminWrite } from './adminWriteGuard.js';
import { parseQuery, readJsonBody } from './announcementEngagement.js';
import { normalizeGlossaryTerm, toRowPayload } from '../../src/utils/glossaryTermMapping.js';

const TABLE = 'glossary_terms';
const MAX_TERMS_PER_REQUEST = 200;
const LIMITS = { slug: 200, title: 300, markdown: 200_000 };

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function toRow(term) {
  const row = toRowPayload(term);
  if (!row || !String(row.slug || '').trim() || !String(row.title || '').trim()) return null;
  if (row.slug.length > LIMITS.slug || row.title.length > LIMITS.title) return null;
  if (String(row.markdown || '').length > LIMITS.markdown) return null;
  return row;
}

export async function handleGlossaryAdmin(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return json(res, 403, { ok: false, status: 'forbidden', message: '관리자 화면에서만 용어를 수정할 수 있습니다.' });
  }

  if (req.method === 'PUT') {
    const body = await readJsonBody(req);
    const terms = Array.isArray(body?.terms) ? body.terms : body?.term ? [body.term] : null;
    if (!terms?.length) {
      return json(res, 400, { ok: false, status: 'error', message: 'term 또는 terms 가 필요합니다.' });
    }
    if (terms.length > MAX_TERMS_PER_REQUEST) {
      return json(res, 400, { ok: false, status: 'error', message: `한 번에 ${MAX_TERMS_PER_REQUEST}건까지만 저장할 수 있습니다.` });
    }
    const rows = terms.map(toRow);
    if (rows.some((r) => !r)) {
      return json(res, 400, { ok: false, status: 'error', message: '제목과 식별자(slug)가 필요하고 길이 제한을 넘을 수 없습니다.' });
    }
    if (new Set(rows.map((r) => r.slug)).size !== rows.length) {
      return json(res, 400, { ok: false, status: 'error', message: '같은 slug 가 중복되었습니다.' });
    }
    const { data, error } = await client.from(TABLE).upsert(rows, { onConflict: 'slug' }).select();
    if (error) return json(res, 500, { ok: false, status: 'error', message: error.message });
    return json(res, 200, { ok: true, status: 'ok', data: (data || []).map(normalizeGlossaryTerm).filter(Boolean) });
  }

  if (req.method === 'DELETE') {
    const slug = String(parseQuery(req).slug || '').trim();
    if (!slug) return json(res, 400, { ok: false, status: 'error', message: 'slug 가 필요합니다.' });
    const { error } = await client.from(TABLE).delete().eq('slug', slug);
    if (error) return json(res, 500, { ok: false, status: 'error', message: error.message });
    return json(res, 200, { ok: true, status: 'ok', data: { slug } });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return json(res, 405, { ok: false, status: 'error', message: 'method not allowed' });
}
