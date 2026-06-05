import { describe, expect, it } from 'vitest';
import { buildKpi3AcademizerOperationalSeed } from '../src/data/kpi3SeedAcademizerScenario.js';
import { DM_PROFILE } from '../src/constants/kpi3DmProfile.js';
import { resolveDmProfile } from '../src/constants/kpi3DmProfile.js';
import {
  computeDmScore,
  computeLeaderScore,
  computePracticeScore,
  leaderScoreFromKpiGrades,
} from '../src/utils/kpi3ElementScores.js';

describe('resolveDmProfile', () => {
  it('maps team roles', () => {
    expect(resolveDmProfile('강사')).toBe(DM_PROFILE.INSTRUCTOR);
    expect(resolveDmProfile('겸업')).toBe(DM_PROFILE.DUAL);
    expect(resolveDmProfile('기획/운영')).toBe(DM_PROFILE.PLANNER);
  });
});

describe('computeDmScore', () => {
  it('blends lecture and ops when N met (legacy 70:30)', () => {
    expect(computeDmScore({ lectureAvg: 4, lectureN: 5, opsAvg: 3, opsN: 3 }).score).toBe(3.7);
  });

  it('instructor uses lecture only even when ops N met', () => {
    expect(
      computeDmScore(
        { lectureAvg: 4.25, lectureN: 6, opsAvg: 4, opsN: 4 },
        { dmProfile: DM_PROFILE.INSTRUCTOR }
      ).score
    ).toBe(4.25);
  });

  it('dual uses M/M activity weights when both axes valid', () => {
    const r = computeDmScore(
      { lectureAvg: 4, lectureN: 5, opsAvg: 3, opsN: 3 },
      { dmProfile: DM_PROFILE.DUAL, activityWeights: { lectureWeight: 0.6, opsWeight: 0.4 } }
    );
    expect(r.score).toBe(3.6);
    expect(r.note).toContain('겸업 M/M');
  });

  it('ops only when lecture N low', () => {
    expect(computeDmScore({ lectureAvg: 4, lectureN: 2, opsAvg: 3.5, opsN: 4 }).score).toBe(3.5);
  });

  it('blends lecture with prev quarter when 3<=N<5', () => {
    const r = computeDmScore(
      { lectureAvg: 3.6, lectureN: 4, opsAvg: 3.9, opsN: 3 },
      { prevQuarter: { lectureAvg: 3.5, opsAvg: 3.6 } }
    );
    expect(r.score).toBeGreaterThan(3.6);
    expect(r.note).toContain('0.6');
  });
});

describe('computeLeaderScore', () => {
  it('40/60 blend', () => {
    expect(computeLeaderScore({ memberSelf: 3, managerScore: 4 })).toBe(3.6);
  });
});

describe('leaderScoreFromKpiGrades', () => {
  it('uses conservative min', () => {
    expect(leaderScoreFromKpiGrades('A', 'C')).toBe(2);
  });
});

describe('computePracticeScore', () => {
  it('maps approved count', () => {
    expect(
      computePracticeScore({
        cases: [{ approved: true }, { approved: true }, { approved: true }],
      })
    ).toBe(5);
    expect(computePracticeScore({ cases: [{ approved: false }] })).toBe(2);
  });
});

describe('kpi3Academizer seed', () => {
  it('fills 2Q composites for all members', () => {
    const { quarters, competencyMonths } = buildKpi3AcademizerOperationalSeed();
    expect(competencyMonths['2026-06']?.A?.managerLocked).toBe(true);
    ['A', 'B', 'C'].forEach((code) => {
      expect(quarters['2026-2Q'][code].quarter.composite).toBeGreaterThan(0);
      expect(quarters['2026-2Q'][code].quarter.dm).toBeGreaterThan(0);
      expect(quarters['2026-2Q'][code].quarter.leader).toBeGreaterThan(0);
      expect(quarters['2026-2Q'][code].quarter.practice).toBeGreaterThan(0);
    });
  });
});
