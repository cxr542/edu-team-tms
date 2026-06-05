import { describe, expect, it } from 'vitest';
import { buildTeamIntegratedSummary } from '../src/utils/teamKpiAggregate.js';
import { buildTeamKpiCoaching } from '../src/utils/teamKpiCoaching.js';

describe('buildTeamKpiCoaching', () => {
  it('produces team-wide strengths and HQ recommendations', () => {
    const monthly = [
      {
        member: { code: 'A', displayName: '김윤형', role: '강사' },
        kpi1: { utilization: 26, work: 1, improve: 0, leave: 1, available: 7 },
        kpi2: { productivityPct: 160, effectCount: 1 },
        rows02: [],
        grade1: 'D',
        grade2: 'A',
        status: '작성중',
      },
      {
        member: { code: 'B', displayName: '최우성', role: '겸업' },
        kpi1: { utilization: 30, work: 1, improve: 0, leave: 0, available: 5 },
        kpi2: { productivityPct: 150, effectCount: 1 },
        rows02: [],
        grade1: 'D',
        grade2: 'A',
        status: '작성중',
      },
    ];
    const quarterly = [
      {
        member: { code: 'A', displayName: '김윤형' },
        quarter: { level: 3.6, dm: 4.2, leader: 3.6, practice: 4, composite: 3.8 },
        breakdown: {},
        grade3: 'B',
      },
    ];
    const team = buildTeamIntegratedSummary(monthly, quarterly);
    const r = buildTeamKpiCoaching(team, monthly, quarterly, { yq: '2026-2Q' });
    expect(r.ready).toBe(true);
    expect(r.strengths.length).toBeGreaterThan(0);
    expect(r.recommendations.some((x) => x.type === 'action' || x.type === 'note')).toBe(true);
  });
});
