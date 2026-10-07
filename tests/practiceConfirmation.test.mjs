import { describe, expect, it } from 'vitest';
import {
  PRACTICE_SCORE_NO_EVIDENCE,
  computePracticeScore,
  resolvePracticeForConfirmation,
} from '../src/utils/kpi3ElementScores.js';
import { computeKpi3Composite, gradeKpi3 } from '../src/utils/kpiGrades.js';
import { defaultQuarterRecord, normalizeKpiOperationalStore } from '../src/constants/kpiOperationalStore.js';

const cases = (n, approved = 0) => ({ cases: Array.from({ length: n }, (_, i) => ({ approved: i < approved })) });

describe('실전 적용 — 분기 확정 시 증빙 미제출 1점 (정의서 v6 5점 척도)', () => {
  it('1점 상수', () => {
    expect(PRACTICE_SCORE_NO_EVIDENCE).toBe(1);
  });

  it('점수가 없고 사례도 0건 → 1점(증빙 미제출)으로 확정', () => {
    const r = resolvePracticeForConfirmation(cases(0), 0);
    expect(r).toEqual({ action: 'default-no-evidence', score: 1, caseCount: 0 });
    expect(resolvePracticeForConfirmation(undefined, undefined).action).toBe('default-no-evidence');
    expect(resolvePracticeForConfirmation({}, null).score).toBe(1);
  });

  it('이미 점수가 있으면 그대로 둔다 (5점 포함, 입력값을 덮어쓰지 않음)', () => {
    expect(resolvePracticeForConfirmation(cases(0), 4)).toEqual({ action: 'keep', score: 4, caseCount: 0 });
    expect(resolvePracticeForConfirmation(cases(3, 3), 5).action).toBe('keep');
  });

  it('사례가 제출됐지만 점수가 없으면(팀장 검토 전) 임의로 점수를 매기지 않는다', () => {
    const r = resolvePracticeForConfirmation(cases(2, 0), 0);
    expect(r).toEqual({ action: 'pending-review', score: null, caseCount: 2 });
  });

  it('입력 중 점수 계산(computePracticeScore)은 그대로: 사례 0건이면 null', () => {
    expect(computePracticeScore(cases(0))).toBeNull();
    expect(computePracticeScore(cases(2, 0))).toBe(2);
    expect(computePracticeScore(cases(3, 3))).toBe(5);
  });

  it('1점이 종합에 반영된다 (평균에서 빠지지 않음)', () => {
    const without = computeKpi3Composite({ level: 3.67, dm: 4, leader: 3.5, practice: 0 });
    const withOne = computeKpi3Composite({ level: 3.67, dm: 4, leader: 3.5, practice: 1 });
    expect(withOne).toBeGreaterThan(without);
    expect(withOne).toBe(Math.round((3.67 * 0.35 + 4 * 0.15 + 3.5 * 0.25 + 1 * 0.25) * 100) / 100);
    expect(gradeKpi3(withOne)).toBe('D'); // 3.0 미만 구간 판정은 기존 규칙 그대로
  });

  it('저장 레코드: practiceDefaulted 기본값, 기존 레코드는 값 그대로', () => {
    expect(defaultQuarterRecord('A').quarter.practiceDefaulted).toBe(false);
    const old = {
      quarters: { '2026-2Q': { A: { memos: [], quarter: { level: 3.6, practice: 4, composite: 3.81, grade: 'B', locked: true } } } },
    };
    const n = normalizeKpiOperationalStore(old).quarters['2026-2Q'].A;
    expect(n.quarter.practiceDefaulted).toBe(false);
    expect(n.quarter.practice).toBe(4);
    expect(n.quarter.composite).toBe(3.81);
  });
});
