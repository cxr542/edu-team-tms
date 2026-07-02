import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

const KPI_MONTHLY_APPROVALS_TABLE = 'kpi_monthly_approvals';
const KPI2_ROW_APPROVALS_TABLE = 'kpi2_row_approvals';
const SELECT_MONTHLY_APPROVAL_FIELDS =
  'member_code, year_month, status, submitted_at, approved_at, approver, reject_reason, monthly01, payload_version, updated_at';
const SELECT_KPI2_APPROVAL_FIELDS =
  'member_code, day_key, task_id, status, submitted_at, approved_at, approver, reject_reason, kpi2_row_status, payload_version, updated_at';

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
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

function monthBounds(year, monthIndex) {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    yearMonth: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
    dayStart: start.toISOString().slice(0, 10),
    dayEnd: end.toISOString().slice(0, 10),
  };
}

async function loadRows(client, table, selectFields, emptyMessage, buildQuery) {
  const query = buildQuery(client.from(table).select(selectFields));
  const { data, error } = await query;

  if (error) {
    return result({ ok: false, status: 'error', message: error.message });
  }

  if (!data || data.length === 0) {
    return result({ ok: true, status: 'empty', message: emptyMessage, data: [] });
  }

  return result({
    ok: true,
    status: 'ok',
    message: 'KPI approval rows loaded from Supabase.',
    data,
  });
}

export async function listSubmittedKpiMonthlyApprovalsFromSupabase({
  year,
  monthIndex,
} = {}) {
  if (!Number.isInteger(year)) {
    return result({ ok: false, status: 'error', message: 'year is required.' });
  }
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return result({ ok: false, status: 'error', message: 'monthIndex must be 0-11.' });
  }
  if (!isSupabaseConfigured) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  const { yearMonth } = monthBounds(year, monthIndex);

  try {
    return await loadRows(
      client,
      KPI_MONTHLY_APPROVALS_TABLE,
      SELECT_MONTHLY_APPROVAL_FIELDS,
      'KPI monthly approval rows were not found.',
      (query) => query.eq('year_month', yearMonth).eq('status', 'submitted').order('member_code')
    );
  } catch (error) {
    return unexpectedErrorResult(error, 'read');
  }
}

export async function listSubmittedKpi2RowApprovalsFromSupabase({
  year,
  monthIndex,
} = {}) {
  if (!Number.isInteger(year)) {
    return result({ ok: false, status: 'error', message: 'year is required.' });
  }
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return result({ ok: false, status: 'error', message: 'monthIndex must be 0-11.' });
  }
  if (!isSupabaseConfigured) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  const { dayStart, dayEnd } = monthBounds(year, monthIndex);

  try {
    return await loadRows(
      client,
      KPI2_ROW_APPROVALS_TABLE,
      SELECT_KPI2_APPROVAL_FIELDS,
      'KPI2 approval rows were not found.',
      (query) =>
        query
          .gte('day_key', dayStart)
          .lt('day_key', dayEnd)
          .eq('status', 'submitted')
          .order('member_code')
          .order('day_key')
          .order('task_id')
    );
  } catch (error) {
    return unexpectedErrorResult(error, 'read');
  }
}

export async function listSubmittedKpiApprovalRowsFromSupabase(period = {}) {
  const [monthlyResult, kpi2Result] = await Promise.all([
    listSubmittedKpiMonthlyApprovalsFromSupabase(period),
    listSubmittedKpi2RowApprovalsFromSupabase(period),
  ]);

  if (monthlyResult.status !== 'ok' && monthlyResult.status !== 'empty') return monthlyResult;
  if (kpi2Result.status !== 'ok' && kpi2Result.status !== 'empty') return kpi2Result;

  return result({
    ok: true,
    status: monthlyResult.status === 'empty' && kpi2Result.status === 'empty' ? 'empty' : 'ok',
    message: 'Submitted KPI approval rows loaded from Supabase.',
    data: {
      monthlyApprovals: monthlyResult.data || [],
      kpi2RowApprovals: kpi2Result.data || [],
    },
  });
}
