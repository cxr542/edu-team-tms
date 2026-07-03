import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import {
  formatCsrRequestCategoryLabel,
  normalizeCsrRequestCategory,
  normalizeCsrRequestStatus,
} from '../constants/csrRequests.js';

const CSR_REQUESTS_TABLE = 'csr_requests';
const PAYLOAD_VERSION = 1;

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
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
  return {
    id: String(row.id || '').trim(),
    title: String(row.title || '').trim(),
    description: typeof row.description === 'string' ? row.description.trim() : '',
    category: normalizeCsrRequestCategory(row.category),
    status: normalizeCsrRequestStatus(row.status),
    requester: String(row.requester || '').trim(),
    requesterCode: String(row.requester_code || '').trim(),
    adminComment: typeof row.admin_comment === 'string' ? row.admin_comment.trim() : '',
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

function toRowPayload(request, updatedAt = null) {
  const normalized = normalizeCsrRequest(request);
  if (!normalized) return null;
  const status = normalizeCsrRequestStatus(normalized.status);
  const completedAt = status === 'done' ? normalized.completedAt || normalized.updatedAt || nowIso() : null;
  return {
    id: normalized.id || randomId(),
    title: normalized.title,
    description: normalized.description,
    category: normalizeCsrRequestCategory(normalized.category),
    status,
    requester: normalized.requester,
    requester_code: normalized.requesterCode,
    admin_comment: normalized.adminComment,
    created_at: normalized.createdAt || updatedAt || nowIso(),
    updated_at: updatedAt || normalized.updatedAt || nowIso(),
    completed_at: completedAt,
    payload_version: PAYLOAD_VERSION,
  };
}

async function saveRow(client, row) {
  const { data, error } = await client
    .from(CSR_REQUESTS_TABLE)
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    return result({ ok: false, status: 'error', message: error.message });
  }

  return result({
    ok: true,
    status: 'ok',
    message: 'CSR request saved to Supabase.',
    data: normalizeCsrRequest(data),
  });
}

export async function upsertCsrRequestToSupabase(request) {
  if (!request || typeof request !== 'object') {
    return result({ ok: false, status: 'error', message: 'request is required.' });
  }
  if (!hasText(request.title)) {
    return result({ ok: false, status: 'error', message: 'title is required.' });
  }
  if (!hasText(request.requester)) {
    return result({ ok: false, status: 'error', message: 'requester is required.' });
  }
  if (!hasText(request.requesterCode)) {
    return result({ ok: false, status: 'error', message: 'requesterCode is required.' });
  }
  if (!isConfigured()) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    const payload = toRowPayload(request);
    if (!payload) {
      return result({ ok: false, status: 'error', message: 'CSR request payload is invalid.' });
    }
    return await saveRow(client, payload);
  } catch (error) {
    return unexpectedErrorResult(error, 'save');
  }
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

export async function updateCsrRequestStatusInSupabase({
  request,
  id,
  status,
  adminComment,
} = {}) {
  const target = request || {};
  const normalizedStatus = normalizeCsrRequestStatus(status ?? target.status);
  const current = normalizeCsrRequest(target);
  const payload = {
    ...(current || {}),
    id: String(id || target.id || '').trim(),
    title: String(target.title || '').trim(),
    description: String(target.description || '').trim(),
    category: normalizeCsrRequestCategory(target.category),
    status: normalizedStatus,
    requester: String(target.requester || '').trim(),
    requesterCode: String(target.requesterCode || '').trim(),
    adminComment: typeof adminComment === 'string' ? adminComment.trim() : String(target.adminComment || '').trim(),
    createdAt: target.createdAt || current?.createdAt || nowIso(),
    updatedAt: nowIso(),
    completedAt:
      normalizedStatus === 'done'
        ? current?.completedAt || target.completedAt || nowIso()
        : null,
  };

  return upsertCsrRequestToSupabase(payload);
}

