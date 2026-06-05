import { describe, expect, it } from 'vitest';
import { getKpi3HqTargetForYq } from '../src/constants/kpi3HeadquartersGoals.js';
import { buildKpi3Coaching } from '../src/utils/kpi3Coaching.js';

describe('getKpi3HqTargetForYq', () => {
  it('returns 2Q target 3.2', () => {
    const t = getKpi3HqTargetForYq('2026-2Q');
    expect(t.minScore).toBe(3.2);
    expect(t.phase).toContain('독립');
  });
});

describe('buildKpi3Coaching', () => {
  it('2Q sample exceeds HQ target (3.2)', () => {
    const r = buildKpi3Coaching(
      { level: 3.6, dm: 4.18, leader: 3.64, practice: 4, composite: 3.8 },
      { yq: '2026-2Q', memberLabel: '김윤형(강사)' }
    );
    expect(r.ready).toBe(true);
    expect(r.hqMet).toBe(true);
    expect(r.hqTarget.minScore).toBe(3.2);
    expect(r.headline).toContain('달성');
  });

  it('3Q gap to HQ 3.8', () => {
    const r = buildKpi3Coaching(
      { level: 3.6, dm: 4.18, leader: 3.64, practice: 4, composite: 3.8 },
      { yq: '2026-3Q' }
    );
    expect(r.hqMet).toBe(true);
    expect(r.hqGap).toBe(0);
  });

  it('empty when no scores', () => {
    const r = buildKpi3Coaching({ level: 0, dm: 0, leader: 0, practice: 0 });
    expect(r.ready).toBe(false);
  });
});
