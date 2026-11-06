import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

const TABLE = 'reference_doc_hidden';
const ADMIN_API = '/api/reference-docs-admin';

/** 숨김 처리된 doc id 목록 (anon 읽기). 실패하면 빈 배열 — 전부 보이는 쪽으로 안전하게 동작. */
export async function listHiddenReferenceDocIds() {
  if (!isSupabaseConfigured) return [];
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from(TABLE).select('doc_id');
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => r.doc_id).filter(Boolean);
  } catch {
    return [];
  }
}

async function callAdmin(method, docId) {
  try {
    const res = await fetch(
      method === 'DELETE' ? `${ADMIN_API}?docId=${encodeURIComponent(docId)}` : ADMIN_API,
      {
        method,
        headers: method === 'PUT' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'PUT' ? JSON.stringify({ docId }) : undefined,
        credentials: 'same-origin',
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      return { ok: false, message: data?.message || `${res.status} ${res.statusText}` };
    }
    return { ok: true, message: 'ok' };
  } catch (error) {
    return { ok: false, message: error?.message || '네트워크 오류' };
  }
}

export const hideReferenceDoc = (docId) => callAdmin('PUT', docId);
export const restoreReferenceDoc = (docId) => callAdmin('DELETE', docId);

const UPLOAD_TABLE = 'reference_doc_uploads';

/** 관리자가 올린 가이드 목록 (본문 제외, anon 읽기). 실패하면 빈 배열. */
export async function listUploadedGuides() {
  if (!isSupabaseConfigured) return [];
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(UPLOAD_TABLE)
      .select('id, title, grp, summary, size_bytes, created_at')
      .order('created_at', { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => ({
      id: r.id,
      category: 'lecture',
      format: 'html',
      group: r.grp,
      title: r.title,
      summary: r.summary || '',
      file: '',
      uploaded: true,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

/** 업로드된 가이드 HTML 본문 1건. */
export async function fetchUploadedGuideHtml(id) {
  const client = isSupabaseConfigured ? getSupabaseClient() : null;
  if (!client) return { ok: false, message: 'Supabase 연결이 설정되지 않았습니다.' };
  try {
    const { data, error } = await client.from(UPLOAD_TABLE).select('html').eq('id', id).maybeSingle();
    if (error || !data) return { ok: false, message: error?.message || '가이드를 찾을 수 없습니다.' };
    return { ok: true, html: data.html };
  } catch (error) {
    return { ok: false, message: error?.message || '네트워크 오류' };
  }
}

async function readAdminResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    return { ok: false, message: data?.message || `${res.status} ${res.statusText}` };
  }
  return { ok: true, data: data?.data };
}

/** 관리자 업로드 (서버가 정화·마스킹을 다시 적용한다). */
export async function uploadLectureGuide({ title, group, summary, html, extraDomains }) {
  try {
    const res = await fetch(ADMIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ title, group, summary, html, extraDomains }),
    });
    return await readAdminResponse(res);
  } catch (error) {
    return { ok: false, message: error?.message || '네트워크 오류' };
  }
}

/** 업로드한 가이드 완전 삭제. */
export async function purgeUploadedGuide(docId) {
  try {
    const res = await fetch(`${ADMIN_API}?docId=${encodeURIComponent(docId)}&purge=1`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    return await readAdminResponse(res);
  } catch (error) {
    return { ok: false, message: error?.message || '네트워크 오류' };
  }
}

async function postAdmin(payload) {
  try {
    const res = await fetch(ADMIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    return await readAdminResponse(res);
  } catch (error) {
    return { ok: false, message: error?.message || '네트워크 오류' };
  }
}

/** 업로드본 수정 (제목·그룹·요약·본문 중 보낸 것만 바뀐다. 본문을 바꾸면 서버가 이전 본문 1개를 보관). */
export const updateUploadedGuide = (docId, fields) => postAdmin({ docId, ...fields });

/** 보관해 둔 이전 본문과 현재 본문을 맞바꾼다. */
export const revertUploadedGuide = (docId) => postAdmin({ docId, action: 'revert' });

/** 편집기용: 본문 + 이전 버전 유무. (이전 버전 컬럼 SQL 을 아직 안 돌렸으면 본문만 읽는다.) */
export async function fetchUploadedGuideForEdit(id) {
  const client = isSupabaseConfigured ? getSupabaseClient() : null;
  if (!client) return { ok: false, message: 'Supabase 연결이 설정되지 않았습니다.' };
  try {
    const full = await client.from(UPLOAD_TABLE).select('html, prev_size_bytes').eq('id', id).maybeSingle();
    if (!full.error && full.data) return { ok: true, html: full.data.html, hasPrevious: Boolean(full.data.prev_size_bytes) };
    const plain = await fetchUploadedGuideHtml(id);
    return plain.ok ? { ok: true, html: plain.html, hasPrevious: false } : plain;
  } catch (error) {
    return { ok: false, message: error?.message || '네트워크 오류' };
  }
}
