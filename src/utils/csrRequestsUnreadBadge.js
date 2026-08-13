import { normalizeCsrRequestStatus } from '../constants/csrRequests.js';

/** Count CSR requests still in triage (접수). */
export function countReceivedCsrRequests(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((count, item) => {
    if (!item || typeof item !== 'object') return count;
    return normalizeCsrRequestStatus(item.status) === 'received' ? count + 1 : count;
  }, 0);
}

/** Get list of CSR requests still in triage (접수). */
export function extractReceivedCsrRequests(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.filter(item => {
    if (!item || typeof item !== 'object') return false;
    return normalizeCsrRequestStatus(item.status) === 'received';
  });
}
