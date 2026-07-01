import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { normalizeSupabaseApprovalStatus } from './kpiOperationalSupabaseRows.js';

export {
  applyKpiApprovalRowsToStore,
  extractKpiApprovalRowsFromStore,
  normalizeSupabaseApprovalStatus,
} from './kpiOperationalSupabaseRows.js';

const KPI_MONTHLY_APPROVALS_TABLE = 'kpi_monthly_approvals';
const KPI2_ROW_APPROVALS_TABLE = 'kpi2_row_approvals';
const PAYLOAD_VERSION = 1;
const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

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

function monthlyUpdatedAt(monthly01, fallback = null) {
  return fallback || monthly01?.approvedAt || monthly01?.submittedAt || nowIso();
}

function rowUpdatedAt(row, fallback = null) {
  return fallback || row?.approvedAt || row?.submittedAt || row?.updatedAt || nowIso();
}

function toApprovalTopLevelFields(record) {
  return {
    status: normalizeSupabaseApprovalStatus(record?.status),
    submitted_at: record?.submittedAt ?? null,
    approved_at: record?.approvedAt ?? null,
    approver: record?.approver ?? null,
    reject_reason: record?.rejectReason ?? null,
  };
}

function toMonthlyApprovalRow(memberCode, yearMonth, monthly01, updatedAt = null) {
  return {
    member_code: memberCode.trim(),
    year_month: yearMonth,
    ...toApprovalTopLevelFields(monthly01),
    monthly01,
    payload_version: PAYLOAD_VERSION,
    updated_at: monthlyUpdatedAt(monthly01, updatedAt),
  };
}

function toKpi2ApprovalRow(memberCode, dayKey, taskId, kpi2RowStatus, updatedAt = null) {
  return {
    member_code: memberCode.trim(),
    day_key: dayKey,
    task_id: taskId,
    ...toApprovalTopLevelFields(kpi2RowStatus),
    kpi2_row_status: kpi2RowStatus,
    payload_version: PAYLOAD_VERSION,
    updated_at: rowUpdatedAt(kpi2RowStatus, updatedAt),
  };
}

async function saveRow(client, table, row, conflictKey) {
  const { data, error } = await client
    .from(table)
    .upsert(row, { onConflict: conflictKey })
    .select()
    .single();

  if (error) {
    return result({ ok: false, status: 'error', message: error.message });
  }

  return result({
    ok: true,
    status: 'ok',
    message: 'KPI approval row saved to Supabase.',
    data,
  });
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
  updatedAt,
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

  try {
    return await saveRow(
      getSupabaseClient(),
      KPI_MONTHLY_APPROVALS_TABLE,
      toMonthlyApprovalRow(memberCode, normalizedYearMonth, monthly01, updatedAt),
      'member_code,year_month'
    );
  } catch (error) {
    return unexpectedErrorResult(error, 'save');
  }
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
  updatedAt,
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

  try {
    return await saveRow(
      getSupabaseClient(),
      KPI2_ROW_APPROVALS_TABLE,
      toKpi2ApprovalRow(memberCode, dayKey, taskId, kpi2RowStatus, updatedAt),
      'member_code,day_key,task_id'
    );
  } catch (error) {
    return unexpectedErrorResult(error, 'save');
  }
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
