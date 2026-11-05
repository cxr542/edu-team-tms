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
