import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import {
  formatCsrRequestCategoryLabel,
  normalizeCsrRequestCategory,
  normalizeCsrRequestStatus,
} from '../constants/csrRequests.js';
import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers.js';

const CSR_REQUESTS_TABLE = 'csr_requests';
const CSR_REQUESTS_API = '/api/csr-requests';
const ADMIN_SESSION_MESSAGE =
  '관리자 로그인이 만료되었거나 필요합니다. /admin 에서 다시 로그인한 뒤 시도해 주세요.';

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readRequesterCode(row) {
  if (!row || typeof row !== 'object') return '';
  return String(row.requester_code || row.requesterCode || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function supabaseDisabledResult() {
  return result({
    ok: false,
    status: 'disabled',
    message: 'Supabase environment variables are not configured.',
  });
}

function unexpectedErrorResult(error, operation) {
  return result({
    ok: false,
    status: 'error',
    message:
      error instanceof Error ? error.message : `Unknown Supabase CSR request ${operation} error.`,
  });
}

function isConfigured() {
  if (!isSupabaseConfigured) return false;
  return Boolean(getSupabaseClient());
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `csr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeCsrRequest(row) {
  if (!row || typeof row !== 'object') return null;

  let requesterCode = readRequesterCode(row);
  const requesterName = String(row.requester || '').trim();
  if (!requesterCode && requesterName) {
    const member = TEAM_KPI_MEMBERS.find((m) => m.displayName === requesterName);
    if (member) {
      requesterCode = member.code;
    }
  }

  const adminComment =
    typeof row.admin_comment === 'string'
      ? row.admin_comment.trim()
      : typeof row.adminComment === 'string'
      ? row.adminComment.trim()
      : '';

  return {
    id: String(row.id || '').trim(),
    title: String(row.title || '').trim(),
    description: typeof row.description === 'string' ? row.description.trim() : '',
    category: normalizeCsrRequestCategory(row.category),
    status: normalizeCsrRequestStatus(row.status),
    requester: requesterName,
    requesterCode,
    adminComment,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    completedAt: row.completed_at || row.completedAt || null,
    categoryLabel: formatCsrRequestCategoryLabel(row.category),
  };
}

export function buildCsrRequestDraft({
  title,
  description,
  category,
  requester,
  requesterCode,
} = {}) {
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) {
    return { ok: false, status: 'error', message: 'title is required.' };
  }

  const normalizedRequester = String(requester || '').trim();
  if (!normalizedRequester) {
    return { ok: false, status: 'error', message: 'requester is required.' };
  }

  const normalizedRequesterCode = String(requesterCode || '').trim();
  if (!normalizedRequesterCode) {
    return { ok: false, status: 'error', message: 'requesterCode is required.' };
  }

  const createdAt = nowIso();

  return {
    ok: true,
    status: 'ok',
    message: 'CSR request draft created.',
    data: {
      id: randomId(),
      title: normalizedTitle,
      description: String(description || '').trim(),
      category: normalizeCsrRequestCategory(category),
      status: 'received',
      requester: normalizedRequester,
      requesterCode: normalizedRequesterCode,
      adminComment: '',
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
    },
  };
}

/**
 * 쓰기는 서버 경로(/api/csr-requests)로만 한다. 서버가 id·상태·시각·요청자 이름을 정하고,
 * 상태·코멘트 수정은 관리자 세션 쿠키를 확인한다. 읽기는 아래 list 함수가 anon 으로 직접 한다.
 */
async function callCsrApi(method, body, { forbiddenMessage, raw = false } = {}) {
  let res;
  try {
    res = await fetch(CSR_REQUESTS_API, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
      message: (forbidden && forbiddenMessage) || data?.message || `HTTP ${res.status}`,
    });
  }
  return result({
    ok: true,
    status: 'ok',
    message: 'CSR request saved.',
    data: raw ? data?.data ?? null : normalizeCsrRequest(data?.data),
  });
}

/** 새 요청 등록. 보내는 값은 제목·내용·분류·요청자 코드뿐이다(나머지는 서버가 정한다). */
export async function createCsrRequestInSupabase(request) {
  if (!request || typeof request !== 'object') {
    return result({ ok: false, status: 'error', message: 'request is required.' });
  }
  if (!hasText(request.title)) {
    return result({ ok: false, status: 'error', message: 'title is required.' });
  }
  if (!hasText(request.requesterCode)) {
    return result({ ok: false, status: 'error', message: 'requesterCode is required.' });
  }
  if (!isConfigured()) return supabaseDisabledResult();

  return callCsrApi('POST', {
    title: request.title,
    description: request.description,
    category: normalizeCsrRequestCategory(request.category),
    requesterCode: request.requesterCode,
  });
}

export async function listCsrRequestsFromSupabase({ requesterCode } = {}) {
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    let query = client
      .from(CSR_REQUESTS_TABLE)
      .select('id, title, description, category, status, requester, requester_code, admin_comment, created_at, updated_at, completed_at, payload_version')
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (hasText(requesterCode)) {
      query = query.eq('requester_code', requesterCode.trim());
    }

    const { data, error } = await query;

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    if (!data || data.length === 0) {
      return result({ ok: true, status: 'empty', message: 'CSR requests were not found.', data: [] });
    }

    return result({
      ok: true,
      status: 'ok',
      message: 'CSR requests loaded from Supabase.',
      data: data.map(normalizeCsrRequest).filter(Boolean),
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'read');
  }
}

/** 상태·관리자 코멘트 수정(관리자 세션 필요). 제목·내용·요청자는 바꾸지 않는다. */
export async function updateCsrRequestStatusInSupabase({
  request,
  id,
  status,
  adminComment,
} = {}) {
  const target = request || {};
  if (!isConfigured()) return supabaseDisabledResult();

  return callCsrApi(
    'PATCH',
    {
      id: String(id || target.id || '').trim(),
      status: normalizeCsrRequestStatus(status ?? target.status),
      adminComment:
        typeof adminComment === 'string' ? adminComment : String(target.adminComment || ''),
    },
    { forbiddenMessage: ADMIN_SESSION_MESSAGE }
  );
}

/** 제목·내용·분류 수정(관리자 세션 필요). 상태·코멘트·요청자는 바꾸지 않는다. */
export async function updateCsrRequestContentInSupabase({ id, title, description, category } = {}) {
  if (!hasText(id)) return result({ ok: false, status: 'error', message: 'id is required.' });
  if (!hasText(title)) return result({ ok: false, status: 'error', message: 'title is required.' });
  if (!isConfigured()) return supabaseDisabledResult();

  return callCsrApi(
    'PATCH',
    {
      id: String(id).trim(),
      title,
      description: typeof description === 'string' ? description : '',
      category: normalizeCsrRequestCategory(category),
    },
    { forbiddenMessage: ADMIN_SESSION_MESSAGE }
  );
}

/** 요청 삭제(관리자 세션 필요). 서버가 첨부 파일까지 함께 지운다. */
export async function deleteCsrRequestFromSupabase(id) {
  if (!hasText(id)) return result({ ok: false, status: 'error', message: 'id is required.' });
  if (!isConfigured()) return supabaseDisabledResult();

  return callCsrApi('DELETE', { id: String(id).trim() }, { forbiddenMessage: ADMIN_SESSION_MESSAGE, raw: true });
}
