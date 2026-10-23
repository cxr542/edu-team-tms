import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { normalizeGlossaryTerm, toRowPayload } from './glossaryTermMapping.js';

export { normalizeGlossaryTerm, toRowPayload };

export const GLOSSARY_TABLE = 'glossary_terms';

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function supabaseDisabledResult() {
  return result({
    ok: false,
    status: 'disabled',
    message: 'Supabase is not configured.',
  });
}

function unexpectedErrorResult(error, operation) {
  return result({
    ok: false,
    status: 'error',
    message:
      error instanceof Error ? error.message : `Unknown Supabase glossary ${operation} error.`,
  });
}

function isConfigured() {
  if (!isSupabaseConfigured) return false;
  return Boolean(getSupabaseClient());
}

export async function listGlossaryTermsFromSupabase() {
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    const { data, error } = await client
      .from(GLOSSARY_TABLE)
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    if (!data || data.length === 0) {
      return result({ ok: true, status: 'empty', message: 'No glossary terms in Supabase.', data: [] });
    }

    const items = data.map(normalizeGlossaryTerm).filter(Boolean);
    return result({
      ok: true,
      status: 'ok',
      message: 'Glossary terms loaded from Supabase.',
      data: items,
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'list');
  }
}

const ADMIN_API = '/api/glossary-admin';

/** 관리자 서버 API 호출. 쓰기는 서버가 관리자 세션을 확인한 뒤 service role 로 수행한다. */
async function callAdminApi(method, { query = '', body } = {}) {
  let res;
  try {
    res = await fetch(`${ADMIN_API}${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch (error) {
    return result({ ok: false, status: 'error', message: error?.message || '네트워크 오류' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const forbidden = res.status === 403;
    return result({
      ok: false,
      status: forbidden ? 'forbidden' : 'error',
      message: forbidden
        ? '관리자 로그인이 필요합니다. /admin 에서 다시 로그인한 뒤 시도해 주세요.'
        : data?.message || `HTTP ${res.status}`,
    });
  }
  return result({ ok: true, status: 'ok', message: data?.message || 'ok', data: data?.data ?? null });
}

export async function upsertGlossaryTermToSupabase(term) {
  if (!isConfigured()) return supabaseDisabledResult();
  const payload = toRowPayload(term);
  if (!payload || !hasText(payload.slug) || !hasText(payload.title)) {
    return result({ ok: false, status: 'error', message: 'Title and slug are required.' });
  }
  const res = await callAdminApi('PUT', { body: { term } });
  if (!res.ok) return res;
  const saved = Array.isArray(res.data) ? res.data[0] : res.data;
  return result({
    ok: true,
    status: 'ok',
    message: 'Term saved to Supabase.',
    data: saved ? normalizeGlossaryTerm(saved) : normalizeGlossaryTerm(payload),
  });
}

/** 여러 용어를 한 번에 저장(초기 시드 반영용). 한 요청에 최대 200건. */
export async function upsertGlossaryTermsToSupabase(terms) {
  if (!isConfigured()) return supabaseDisabledResult();
  const res = await callAdminApi('PUT', { body: { terms } });
  if (!res.ok) return res;
  return result({
    ok: true,
    status: 'ok',
    message: 'Terms saved to Supabase.',
    data: Array.isArray(res.data) ? res.data.map(normalizeGlossaryTerm).filter(Boolean) : [],
  });
}

export async function deleteGlossaryTermFromSupabase(slug) {
  if (!isConfigured()) return supabaseDisabledResult();
  const res = await callAdminApi('DELETE', { query: `?slug=${encodeURIComponent(slug)}` });
  if (!res.ok) return res;
  return result({ ok: true, status: 'ok', message: 'Term deleted from Supabase.', data: { slug } });
}
