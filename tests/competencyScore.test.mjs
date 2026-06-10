import { describe, expect, it } from 'vitest';
import {
  accumulateFractional,
  applyCap,
  applyDimChange,
  computeCompetencyEval,
  isDimsComplete,
  mround02,
  monthlyFinalScore,
  normalizeCompetencyEvalSide,
  normalizeDimsChain,
  proposedComposite,
  quarterAverageLevel,
} from '../src/utils/competencyScore.js';
import {
  COMPETENCY_DIMS,
  COMPETENCY_DIM_IDS,
  defaultCompetencyDims,
  DIM_MET,
  DIM_UNMET,
} from '../src/constants/competencyRubric.js';
import { RUBRIC_ROWS } from '../src/constants/competencyRubricText.js';

function dims(...values) {
  const ids = ['autonomy', 'scope', 'collaboration', 'quality', 'expertise'];
  return Object.fromEntries(ids.map((id, i) => [id, values[i]]));
}

describe('competencyScore', () => {
  it('기본 dims — 5개 모두 unmet', () => {
    const d = defaultCompetencyDims();
    expect(Object.keys(d)).toHaveLength(5);
    expect(COMPETENCY_DIM_IDS.every((id) => d[id] === DIM_UNMET)).toBe(true);
  });

  it('빈 dims 값이 normalize 후 unmet', () => {
    const normalized = normalizeDimsChain(dims('', null, undefined, DIM_MET, DIM_UNMET));
    expect(normalized.autonomy).toBe(DIM_UNMET);
    expect(normalized.scope).toBe(DIM_UNMET);
    expect(normalized.collaboration).toBe(DIM_UNMET);
    expect(normalized.quality).toBe(DIM_UNMET);
    expect(normalized.expertise).toBe(DIM_UNMET);
  });

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

  it('빈 dims 입력 — normalize 후 fractional 0, proposed === intLevel', () => {
    const r = computeCompetencyEval({ intLevel: 3, dims: dims('', '', '', '', ''), roleId: 'default' });
    expect(r.fractional).toBe(0);
    expect(r.proposed).toBe(3);
    expect(r.proposed).toBe(proposedComposite(3, 0));
  });

  it('intLevel + 5차원 충족 시 proposed에 가산 반영 (B 겸업/default)', () => {
    const onlyLevel = computeCompetencyEval({
      intLevel: 3,
      dims: defaultCompetencyDims(),
      roleId: 'default',
    });
    const withDims = computeCompetencyEval({
      intLevel: 3,
      dims: dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, DIM_MET),
      roleId: 'default',
    });
    expect(withDims.proposed).toBeGreaterThan(onlyLevel.proposed);
    expect(withDims.proposed).toBe(4);
  });

  it('isDimsComplete — normalize 후 항상 true', () => {
    expect(isDimsComplete(normalizeDimsChain(dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, '')))).toBe(true);
    expect(isDimsComplete(normalizeDimsChain(dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, DIM_UNMET)))).toBe(true);
  });

  it('5개 모두 unmet — fractional 0, proposed === intLevel', () => {
    const r = computeCompetencyEval({
      intLevel: 2,
      dims: dims(DIM_UNMET, DIM_UNMET, DIM_UNMET, DIM_UNMET, DIM_UNMET),
      roleId: 'default',
    });
    expect(r.fractional).toBe(0);
    expect(r.proposed).toBe(2);
  });

  it('앞에서부터 1개 met — fractional 0.2, proposed intLevel + 0.2', () => {
    const r = computeCompetencyEval({
      intLevel: 2,
      dims: dims(DIM_MET, DIM_UNMET, DIM_UNMET, DIM_UNMET, DIM_UNMET),
      roleId: 'default',
    });
    expect(r.fractional).toBe(0.2);
    expect(r.proposed).toBe(2.2);
  });

  it('앞에서부터 2개 met — fractional 0.4', () => {
    const r = computeCompetencyEval({
      intLevel: 2,
      dims: dims(DIM_MET, DIM_MET, DIM_UNMET, DIM_UNMET, DIM_UNMET),
      roleId: 'default',
    });
    expect(r.fractional).toBe(0.4);
    expect(r.proposed).toBe(2.4);
  });

  it('5개 모두 met — 최대 fractional 1.0, proposed intLevel + 1', () => {
    const r = computeCompetencyEval({
      intLevel: 2,
      dims: dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, DIM_MET),
      roleId: 'default',
    });
    expect(r.fractional).toBe(1.0);
    expect(r.proposed).toBe(3);
  });

  it('뒤 차원만 met, 앞 unmet — normalize 후 모두 unmet, fractional 0', () => {
    const r = computeCompetencyEval({
      intLevel: 2,
      dims: dims(DIM_UNMET, DIM_UNMET, DIM_UNMET, DIM_MET, DIM_MET),
      roleId: 'default',
    });
    expect(r.fractional).toBe(0);
    expect(r.proposed).toBe(2);
    expect(r.dims).toBeUndefined();
    expect(normalizeDimsChain(dims(DIM_UNMET, DIM_UNMET, DIM_UNMET, DIM_MET, DIM_MET)).quality).toBe(DIM_UNMET);
  });

  it('applyDimChange — 두 번째만 met 시도 시 첫 번째까지 met, 이후 unmet', () => {
    const next = applyDimChange(defaultCompetencyDims(), 'scope', DIM_MET, 'default');
    expect(next.autonomy).toBe(DIM_MET);
    expect(next.scope).toBe(DIM_MET);
    expect(next.collaboration).toBe(DIM_UNMET);
    expect(next.expertise).toBe(DIM_UNMET);
  });

  it('applyDimChange — 중간 unmet 시 하위 차원 unmet', () => {
    const base = dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, DIM_MET);
    const next = applyDimChange(base, 'collaboration', DIM_UNMET, 'default');
    expect(next.autonomy).toBe(DIM_MET);
    expect(next.scope).toBe(DIM_MET);
    expect(next.collaboration).toBe(DIM_UNMET);
    expect(next.quality).toBe(DIM_UNMET);
    expect(next.expertise).toBe(DIM_UNMET);
  });

  it('normalizeCompetencyEvalSide — stale computed·빈 dims 보정', () => {
    const side = normalizeCompetencyEvalSide(
      {
        intLevel: 2,
        dims: dims(DIM_MET, DIM_MET, DIM_MET, DIM_MET, ''),
        computed: { accumulated: 1, capped: 1, fractional: 1, proposed: 3 },
      },
      'default'
    );
    expect(side.dims.expertise).toBe(DIM_UNMET);
    expect(side.computed.fractional).toBe(0.8);
    expect(side.computed.proposed).toBe(2.8);
    expect(side.computed.fractional).not.toBeNull();
    expect(side.computed.proposed).toBeLessThanOrEqual(2 + (side.computed.fractional || 0) + 0.001);
  });

  it('fractional === null이면 proposed가 intLevel보다 커지지 않음', () => {
    expect(proposedComposite(2, null)).toBe(2);
    const r = computeCompetencyEval({ intLevel: 2, dims: defaultCompetencyDims(), roleId: 'default' });
    expect(r.fractional).not.toBeNull();
    expect(r.proposed).toBeLessThanOrEqual(2 + (r.fractional || 0) + 0.001);
  });

  it('COMPETENCY_DIMS — 5개 차원 id 일치', () => {
    expect(COMPETENCY_DIMS).toHaveLength(5);
    expect(COMPETENCY_DIM_IDS).toEqual([
      'autonomy',
      'scope',
      'collaboration',
      'quality',
      'expertise',
    ]);
    const rubricDimIds = RUBRIC_ROWS.map((row) => row.id);
    expect(rubricDimIds.sort()).toEqual([...COMPETENCY_DIM_IDS].sort());
  });
});
