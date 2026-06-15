import { describe, expect, it } from 'vitest';
import {
  listPendingApprovalsFromBrowser,
  summarizePendingApprovals,
} from '../src/utils/kpiReportData.js';

describe('leader KPI pending badge data', () => {
  it('summarizePendingApprovals counts KPI1 and KPI2 items', () => {
    const summary = summarizePendingApprovals([
      { type: 'KPI1' },
      { type: 'KPI2' },
      { type: 'KPI2' },
    ]);
    expect(summary).toEqual({ total: 3, kpi1: 1, kpi2: 2 });
  });

  it('listPendingApprovalsFromBrowser returns array', () => {
    const items = listPendingApprovalsFromBrowser({ year: 2026, monthIndex: 5 });
    expect(Array.isArray(items)).toBe(true);
    items.forEach((item) => {
      expect(['KPI1', 'KPI2']).toContain(item.type);
      if (item.type === 'KPI1') {
        expect(item.member?.code).toBeTruthy();
      }
    });
  });
});
