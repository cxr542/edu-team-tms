export const CSR_REQUEST_CATEGORY_LABELS = {
  bug: '버그',
  improvement: '개선요청',
  feature: '추가개발',
  question: '문의',
};

export const CSR_REQUEST_CATEGORY_LIST = Object.entries(CSR_REQUEST_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const CSR_REQUEST_STATUS_LABELS = {
  received: '접수',
  inProgress: '진행 중',
  done: '완료',
  hold: '보류',
  rejected: '불가',
};

export const CSR_REQUEST_STATUS_LIST = Object.entries(CSR_REQUEST_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);

const DEFAULT_CATEGORY = 'improvement';
const DEFAULT_STATUS = 'received';

export function normalizeCsrRequestCategory(value) {
  const next = String(value || '').trim();
  return CSR_REQUEST_CATEGORY_LABELS[next] ? next : DEFAULT_CATEGORY;
}

export function normalizeCsrRequestStatus(value) {
  const next = String(value || '').trim();
  return CSR_REQUEST_STATUS_LABELS[next] ? next : DEFAULT_STATUS;
}

export function formatCsrRequestStatusLabel(status) {
  return CSR_REQUEST_STATUS_LABELS[normalizeCsrRequestStatus(status)] || CSR_REQUEST_STATUS_LABELS.received;
}

export function formatCsrRequestCategoryLabel(category) {
  return CSR_REQUEST_CATEGORY_LABELS[normalizeCsrRequestCategory(category)] || CSR_REQUEST_CATEGORY_LABELS.improvement;
}

export function isCsrRequestDone(status) {
  return normalizeCsrRequestStatus(status) === 'done';
}

