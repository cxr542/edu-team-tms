import { createEmptyKpiOperationalStore } from '../constants/kpiOperationalStore.js';

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const KPI2_ROW_ID_RE = /^([^|]+)\|(\d{4}-\d{2}-\d{2})\|([^|]+)$/;

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone(value) {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
}

function normalizeYearMonth(yearMonth) {
  const value = String(yearMonth || '').trim();
  return YEAR_MONTH_RE.test(value) ? value : null;
}

function parseKpi2RowId(rowId) {
  const match = KPI2_ROW_ID_RE.exec(String(rowId || ''));
  if (!match) return null;
  return {
    memberCode: match[1],
    dayKey: match[2],
    taskId: match[3],
  };
}

function monthlyUpdatedAt(monthly01, fallback = null) {
  return fallback || monthly01?.approvedAt || monthly01?.submittedAt || new Date().toISOString();
}

function rowUpdatedAt(row, fallback = null) {
  return fallback || row?.approvedAt || row?.submittedAt || row?.updatedAt || new Date().toISOString();
}

function hasMonthlyApprovalRow(row) {
  return Boolean(row?.member_code && row?.year_month && row?.monthly01);
}

function hasKpi2ApprovalRow(row) {
  return Boolean(row?.member_code && row?.day_key && row?.task_id && row?.kpi2_row_status);
}

function toMonthlyApprovalRow(memberCode, yearMonth, monthly01, updatedAt = null) {
  return {
    member_code: memberCode.trim(),
    year_month: yearMonth,
    monthly01: clone(monthly01),
    payload_version: 1,
    updated_at: monthlyUpdatedAt(monthly01, updatedAt),
  };
}

function toKpi2ApprovalRow(memberCode, dayKey, taskId, kpi2RowStatus, updatedAt = null) {
  return {
    member_code: memberCode.trim(),
    day_key: dayKey,
    task_id: taskId,
    kpi2_row_status: clone(kpi2RowStatus),
    payload_version: 1,
    updated_at: rowUpdatedAt(kpi2RowStatus, updatedAt),
  };
}

function applyMonthlyApprovalRow(store, row) {
  if (!hasMonthlyApprovalRow(row)) return store;
  const next = createEmptyKpiOperationalStore();
  Object.assign(next, clone(store || {}));
  next.months = { ...(next.months || {}) };
  const month = { ...(next.months[row.year_month] || {}) };
  month[row.member_code] = { monthly01: clone(row.monthly01) };
  next.months[row.year_month] = month;
  return next;
}

function applyKpi2ApprovalRow(store, row) {
  if (!hasKpi2ApprovalRow(row)) return store;
  const parsed = parseKpi2RowId(`${row.member_code}|${row.day_key}|${row.task_id}`);
  if (!parsed) return store;
  const next = createEmptyKpiOperationalStore();
  Object.assign(next, clone(store || {}));
  next.kpi2RowStatus = { ...(next.kpi2RowStatus || {}) };
  next.kpi2RowStatus[`${parsed.memberCode}|${parsed.dayKey}|${parsed.taskId}`] = clone(
    row.kpi2_row_status
  );
  return next;
}

export function extractKpiApprovalRowsFromStore(store) {
  const normalized = createEmptyKpiOperationalStore();
  Object.assign(normalized, clone(store || {}));

  const monthlyApprovals = [];
  Object.entries(normalized.months || {}).forEach(([yearMonth, byMember]) => {
    const normalizedYearMonth = normalizeYearMonth(yearMonth);
    if (!normalizedYearMonth || !byMember || typeof byMember !== 'object') return;
    Object.entries(byMember).forEach(([memberCode, memberMonth]) => {
      if (!hasText(memberCode) || !memberMonth?.monthly01) return;
      monthlyApprovals.push(
        toMonthlyApprovalRow(
          memberCode,
          normalizedYearMonth,
          memberMonth.monthly01,
          memberMonth.monthly01.updatedAt
        )
      );
    });
  });

  const kpi2RowApprovals = [];
  Object.entries(normalized.kpi2RowStatus || {}).forEach(([rowId, kpi2RowStatus]) => {
    const parsed = parseKpi2RowId(rowId);
    if (!parsed || !kpi2RowStatus) return;
    kpi2RowApprovals.push(
      toKpi2ApprovalRow(
        parsed.memberCode,
        parsed.dayKey,
        parsed.taskId,
        kpi2RowStatus,
        kpi2RowStatus.updatedAt
      )
    );
  });

  return { monthlyApprovals, kpi2RowApprovals };
}

export function applyKpiApprovalRowsToStore(store, { monthlyApprovals = [], kpi2RowApprovals = [] } = {}) {
  let next = createEmptyKpiOperationalStore();
  Object.assign(next, clone(store || {}));

  monthlyApprovals.forEach((row) => {
    next = applyMonthlyApprovalRow(next, row);
  });

  kpi2RowApprovals.forEach((row) => {
    next = applyKpi2ApprovalRow(next, row);
  });

  return next;
}
