import { describe, expect, it } from 'vitest';
import { parseKpiDeepLink } from '../src/utils/kpiDeepLink.js';

const TABS = ['overview', 'kpi1', 'kpi2', 'kpi3', 'close', 'export'];

describe('parseKpiDeepLink', () => {
  it('reads a known tab and member', () => {
    expect(parseKpiDeepLink('?kpiTab=kpi2&kpiMember=B', TABS)).toEqual({ tab: 'kpi2', member: 'B' });
  });

  it('falls back to the overview and the team leader for anything unknown', () => {
    expect(parseKpiDeepLink('?kpiTab=nope&kpiMember=Z', TABS)).toEqual({ tab: 'overview', member: 'A' });
    expect(parseKpiDeepLink('', TABS)).toEqual({ tab: 'overview', member: 'A' });
  });

  it('ignores the route member param so it cannot switch the KPI member', () => {
    expect(parseKpiDeepLink('?member=C', TABS).member).toBe('A');
  });
});
