import { describe, expect, it } from 'vitest';
import {
  accumulateFractional,
  applyCap,
  computeCompetencyEval,
  mround02,
  monthlyFinalScore,
  proposedComposite,
  quarterAverageLevel,
} from '../src/utils/competencyScore.js';
import { DIM_MET, DIM_UNMET } from '../src/constants/competencyRubric.js';

function dims(...values) {
  const ids = ['autonomy', 'scope', 'collaboration', 'quality', 'expertise'];
  return Object.fromEntries(ids.map((id, i) => [id, values[i]]));
}

describe('competencyScore', () => {
  it('김윤형 2026-01 — D,E 충족, F 미충족 → 2.4', () => {
    const d = dims(DIM_MET, DIM_MET, DIM_UNMET, DIM_MET, DIM_UNMET);
    const r = computeCompetencyEval({ intLevel: 2, dims: d, roleId: 'default' });
    expect(r.accumulated).toBe(0.4);
    expect(r.fractional).toBe(0.4);
    expect(r.proposed).toBe(2.4);
  });

  it('신혜윤 2026-01 팀장 — D만 충족 → 3.2', () => {
    const d = dims(DIM_MET, DIM_UNMET, DIM_UNMET, DIM_UNMET, DIM_UNMET);
    const r = computeCompetencyEval({ intLevel: 3, dims: d, roleId: 'default' });
    expect(r.accumulated).toBe(0.2);
    expect(r.fractional).toBe(0.2);
    expect(r.proposed).toBe(3.2);
  });

  it('김윤형 2026-03 — 5차원 충족 → 3.0', () => {
    const d = dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, DIM_MET);
    const r = computeCompetencyEval({ intLevel: 2, dims: d, roleId: 'default' });
    expect(r.accumulated).toBe(1.0);
    expect(r.fractional).toBe(1.0);
    expect(r.proposed).toBe(3.0);
  });

  it('mround02', () => {
    expect(mround02(0.35)).toBe(0.4);
    expect(mround02(0.25)).toBe(0.2);
  });

  it('applyCap — 품질 미충족 시 0.4', () => {
    const d = dims(DIM_MET, DIM_MET, DIM_MET, DIM_UNMET, DIM_MET);
    expect(applyCap(0.8, d, 'default')).toBe(0.4);
  });

  it('monthlyFinalScore 40:60', () => {
    expect(monthlyFinalScore(2.0, 3.0, true)).toBe(2.6);
    expect(monthlyFinalScore(2.0, 3.0, false)).toBe(3.0);
  });

  it('quarterAverageLevel', () => {
    expect(quarterAverageLevel([2.4, 2.6, 3.0])).toBe(2.67);
  });

  it('instructor cap — 품질·전문성 둘 다 충족 시 캡 해제', () => {
    const d = dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, DIM_MET);
    expect(applyCap(1.0, d, 'instructor')).toBe(1.0);
    const d2 = dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, DIM_UNMET);
    expect(applyCap(1.0, d2, 'instructor')).toBe(0.4);
  });

  it('planner cap — 협업 미충족', () => {
    const d = dims(DIM_MET, DIM_MET, DIM_UNMET, DIM_MET, DIM_MET);
    expect(applyCap(0.6, d, 'planner')).toBe(0.4);
  });

  it('instructor accumulation order — 전문성 우선', () => {
    const d = dims(DIM_UNMET, DIM_UNMET, DIM_UNMET, DIM_MET, DIM_MET);
    const acc = accumulateFractional(d, ['expertise', 'quality', 'collaboration', 'scope', 'autonomy']);
    expect(acc).toBe(0.4);
  });
});
