import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { normalizeSupabaseApprovalStatus } from './kpiOperationalSupabaseRows.js';

export {
  applyKpiApprovalRowsToStore,
  extractKpiApprovalRowsFromStore,
  normalizeSupabaseApprovalStatus,
} from './kpiOperationalSupabaseRows.js';

const KPI_MONTHLY_APPROVALS_TABLE = 'kpi_monthly_approvals';
const KPI2_ROW_APPROVALS_TABLE = 'kpi2_row_approvals';
const KPI_APPROVALS_API = '/api/kpi-approvals';
const ADMIN_SESSION_MESSAGE =
  '관리자 로그인이 만료되었거나 필요합니다. /admin 에서 다시 로그인한 뒤 시도해 주세요.';
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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
    message: 'Supabase environment variables are not configured.',
  });
}

function unexpectedErrorResult(error, operation) {
  return result({
    ok: false,
    status: 'error',
    message:
      error instanceof Error ? error.message : `Unknown Supabase KPI approval ${operation} error.`,
  });
}

function normalizeYearMonth(yearMonth) {
  const value = String(yearMonth || '').trim();
  return YEAR_MONTH_RE.test(value) ? value : null;
}

function isConfigured() {
  if (!isSupabaseConfigured) return false;
  return Boolean(getSupabaseClient());
}

/**
 * 쓰기는 서버 경로(/api/kpi-approvals)로만 한다. 서버가 상태·시각을 정하고, 승인·반려는 관리자 세션 쿠키를
 * 확인한다. 읽기는 아래 get 함수들과 kpiOperationalSupabaseReads 가 anon 으로 직접 한다.
 */
async function callKpiApprovalsApi(method, body, { forbiddenMessage } = {}) {
  let res;
  try {
    res = await fetch(KPI_APPROVALS_API, {
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
      status: forbidden ? 'forbidden' : res.status === 409 ? 'conflict' : 'error',
      message: (forbidden && forbiddenMessage) || data?.message || `HTTP ${res.status}`,
    });
  }
  return result({
    ok: true,
    status: 'ok',
    message: 'KPI approval row saved.',
    data: data?.data ?? null,
  });
}

/** 구성원 제출·회수(작성중·제출)는 POST, 관리자 승인·반려는 PATCH 로 보낸다. */
function sendApprovalRecord(target, record) {
  const status = normalizeSupabaseApprovalStatus(record?.status);
  if (status === 'approved' || status === 'rejected') {
    return callKpiApprovalsApi(
      'PATCH',
      {
        ...target,
        action: status === 'approved' ? 'approve' : 'reject',
        approver: typeof record?.approver === 'string' ? record.approver : '',
        reason: typeof record?.rejectReason === 'string' ? record.rejectReason : '',
      },
      { forbiddenMessage: ADMIN_SESSION_MESSAGE }
    );
  }
  const body = { status };
  // 업무 수치만 보낸다. 상태·시각·승인 정보는 서버가 정한다.
  ['work', 'improve', 'leave', 'available'].forEach((field) => {
    if (typeof record?.[field] === 'number' && Number.isFinite(record[field])) body[field] = record[field];
  });
  if (typeof record?.note === 'string') body.note = record.note;
  return callKpiApprovalsApi('POST', { ...target, record: body });
}

async function loadRow(client, table, filters, selectFields, emptyMessage) {
  let query = client.from(table).select(selectFields);
  Object.entries(filters).forEach(([column, value]) => {
    query = query.eq(column, value);
  });
  const { data, error } = await query.maybeSingle();

  if (error) {
    return result({ ok: false, status: 'error', message: error.message });
  }

  if (!data) {
    return result({ ok: true, status: 'empty', message: emptyMessage });
  }

  return result({
    ok: true,
    status: 'ok',
    message: 'KPI approval row loaded from Supabase.',
    data,
  });
}

export async function saveKpiMonthlyApprovalToSupabase({
  memberCode,
  yearMonth,
  monthly01,
} = {}) {
  if (!hasText(memberCode)) {
    return result({ ok: false, status: 'error', message: 'memberCode is required.' });
  }
  const normalizedYearMonth = normalizeYearMonth(yearMonth);
  if (!normalizedYearMonth) {
    return result({ ok: false, status: 'error', message: 'yearMonth must be YYYY-MM.' });
  }
  if (!monthly01 || typeof monthly01 !== 'object') {
    return result({ ok: false, status: 'error', message: 'monthly01 is required.' });
  }
  if (!isConfigured()) return supabaseDisabledResult();

  return sendApprovalRecord(
    { kind: 'monthly', memberCode: memberCode.trim(), yearMonth: normalizedYearMonth },
    monthly01
  );
}

export async function getKpiMonthlyApprovalFromSupabase(memberCode, yearMonth) {
  if (!hasText(memberCode)) {
    return result({ ok: false, status: 'error', message: 'memberCode is required.' });
  }
  const normalizedYearMonth = normalizeYearMonth(yearMonth);
  if (!normalizedYearMonth) {
    return result({ ok: false, status: 'error', message: 'yearMonth must be YYYY-MM.' });
  }
  if (!isConfigured()) return supabaseDisabledResult();

  try {
    return await loadRow(
      getSupabaseClient(),
      KPI_MONTHLY_APPROVALS_TABLE,
      { member_code: memberCode.trim(), year_month: normalizedYearMonth },
      'member_code, year_month, status, submitted_at, approved_at, approver, reject_reason, monthly01, payload_version, updated_at',
      'KPI monthly approval row was not found.'
    );
  } catch (error) {
    return unexpectedErrorResult(error, 'read');
  }
}

export async function saveKpi2RowApprovalToSupabase({
  memberCode,
  dayKey,
  taskId,
  kpi2RowStatus,
} = {}) {
  if (!hasText(memberCode)) {
    return result({ ok: false, status: 'error', message: 'memberCode is required.' });
  }
  if (!hasText(dayKey)) {
    return result({ ok: false, status: 'error', message: 'dayKey is required.' });
  }
  if (!hasText(taskId)) {
    return result({ ok: false, status: 'error', message: 'taskId is required.' });
  }
  if (!kpi2RowStatus || typeof kpi2RowStatus !== 'object') {
    return result({ ok: false, status: 'error', message: 'kpi2RowStatus is required.' });
  }
  if (!isConfigured()) return supabaseDisabledResult();

  return sendApprovalRecord(
    { kind: 'kpi2', memberCode: memberCode.trim(), dayKey: dayKey.trim(), taskId: taskId.trim() },
    kpi2RowStatus
  );
}

export async function getKpi2RowApprovalFromSupabase(memberCode, dayKey, taskId) {
  if (!hasText(memberCode)) {
    return result({ ok: false, status: 'error', message: 'memberCode is required.' });
  }
  if (!hasText(dayKey)) {
    return result({ ok: false, status: 'error', message: 'dayKey is required.' });
  }
  if (!hasText(taskId)) {
    return result({ ok: false, status: 'error', message: 'taskId is required.' });
  }
  if (!isConfigured()) return supabaseDisabledResult();

  try {
    return await loadRow(
      getSupabaseClient(),
      KPI2_ROW_APPROVALS_TABLE,
      {
        member_code: memberCode.trim(),
        day_key: dayKey.trim(),
        task_id: taskId.trim(),
      },
      'member_code, day_key, task_id, status, submitted_at, approved_at, approver, reject_reason, kpi2_row_status, payload_version, updated_at',
      'KPI2 approval row was not found.'
    );
  } catch (error) {
    return unexpectedErrorResult(error, 'read');
  }
}
