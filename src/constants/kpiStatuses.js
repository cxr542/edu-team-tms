export const KPI_STATUS = {
  DRAFT: '작성중',
  SUBMITTED: '제출',
  APPROVED: '승인',
  REJECTED: '반려',
};

export const KPI_STATUS_LIST = [
  KPI_STATUS.DRAFT,
  KPI_STATUS.SUBMITTED,
  KPI_STATUS.APPROVED,
  KPI_STATUS.REJECTED,
];

export function canEditKpiRecord(status) {
  return status === KPI_STATUS.DRAFT || status === KPI_STATUS.REJECTED;
}

export function canSubmitKpiRecord(status) {
  return status === KPI_STATUS.DRAFT || status === KPI_STATUS.REJECTED;
}

export function canWithdrawMonthly01(status, monthly01Record = null) {
  if (!monthly01Record) return status === KPI_STATUS.SUBMITTED;
  if (monthly01Record.status === KPI_STATUS.APPROVED || status === KPI_STATUS.APPROVED) {
    return false;
  }
  if (status === KPI_STATUS.SUBMITTED || monthly01Record.status === KPI_STATUS.SUBMITTED) {
    return true;
  }
  if (monthly01Record.submittedAt) {
    return status !== KPI_STATUS.DRAFT && status !== KPI_STATUS.REJECTED;
  }
  return false;
}

/** 월 확정이 제출·승인 대기 상태인지 (UI용) */
export function isMonthly01Submitted(monthly01Record) {
  if (!monthly01Record) return false;
  return canWithdrawMonthly01(monthly01Record.status, monthly01Record);
}

const STATUS_DISPLAY = {
  [KPI_STATUS.DRAFT]: '작성 중',
  [KPI_STATUS.SUBMITTED]: '제출됨',
  [KPI_STATUS.APPROVED]: '승인됨',
  [KPI_STATUS.REJECTED]: '반려됨',
};

export function formatKpiStatusLabel(status) {
  return STATUS_DISPLAY[status] || status || '—';
}
