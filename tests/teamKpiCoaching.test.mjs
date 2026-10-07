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
  it('종합 점수 문구는 첫째 자리로 표기 (정의서 v6 반올림)', () => {
    const mem = (code, name) => ({
      member: { code, displayName: name, role: '강사' },
      kpi1: { utilization: 100, work: 1, improve: 0, leave: 0, available: 1 },
      kpi2: { productivityPct: 150, effectCount: 1 },
      rows02: [],
      grade1: 'S',
      grade2: 'A',
      status: '작성중',
    });
    const monthly = [mem('A', '김윤형'), mem('B', '최우성')];
    const q = (code, name, level, composite) => ({
      member: { code, displayName: name },
      quarter: { level, dm: 3.7, leader: 3.7, practice: 3, composite },
      breakdown: {},
      grade3: 'C',
    });
    const quarterly = [q('A', '김윤형', 3.6, 3.81), q('B', '최우성', 3.25, 3.21)];
    const team = buildTeamIntegratedSummary(monthly, quarterly);
    const r = buildTeamKpiCoaching(team, monthly, quarterly, { yq: '2026-2Q' });
    const texts = r.recommendations.map((x) => x.text || '').join('\n');
    expect(texts).toContain('(종합 3.2점)');
    expect(texts).not.toContain('3.21');
    const headline = r.recommendations.find((x) => x.type === 'headline').text;
    expect(headline).toMatch(/교육팀 핵심 역량 레벨 \d\.\d점\(등급/);
  });
});
