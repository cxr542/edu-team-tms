import { describe, expect, it } from 'vitest';
import { countReceivedCsrRequests } from '../src/utils/csrRequestsUnreadBadge.js';

describe('csrRequestsUnreadBadge', () => {
  it('counts only received requests', () => {
    const items = [
      { id: '1', status: 'received' },
      { id: '2', status: 'inProgress' },
      { id: '3', status: 'done' },
      { id: '4', status: 'hold' },
      { id: '5', status: 'rejected' },
      { id: '6', status: 'received' },
    ];
    expect(countReceivedCsrRequests(items)).toBe(2);
  });

  it('treats unknown status as received via normalize default', () => {
    expect(countReceivedCsrRequests([{ id: 'x', status: 'unknown-status' }])).toBe(1);
  });

  it('returns 0 for empty or invalid lists', () => {
    expect(countReceivedCsrRequests([])).toBe(0);
    expect(countReceivedCsrRequests(null)).toBe(0);
    expect(countReceivedCsrRequests(undefined)).toBe(0);
  });
});
