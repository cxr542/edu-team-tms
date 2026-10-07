import { describe, expect, it } from 'vitest';
import { computeKpi3Composite, gradeKpi3, roundScoreToTenth } from '../src/utils/kpiGrades.js';

describe('kpiGrades KPI3 — 소수 둘째 자리 반올림 후 등급 비교 (정의서 v6)', () => {
  it.each([
    [3.75, 3.8, 'B'],
    [3.74, 3.7, 'C'],
    [3.45, 3.5, 'C'],
    [3.44, 3.4, 'D'],
    [4.25, 4.3, 'S'],
    [4.24, 4.2, 'A'],
  ])('%s → %s → %s', (score, rounded, grade) => {
    expect(roundScoreToTenth(score)).toBe(rounded);
    expect(gradeKpi3(score)).toBe(grade);
  });

  it('정확한 컷 값과 빈 값', () => {
    expect(gradeKpi3(4.0)).toBe('A');
    expect(gradeKpi3(3.8)).toBe('B');
    expect(gradeKpi3(3.5)).toBe('C');
    expect(gradeKpi3(null)).toBe('—');
    expect(gradeKpi3(NaN)).toBe('—');
  });

  it('computeKpi3Composite는 둘째 자리까지 유지(표시용), 등급만 첫째 자리 기준', () => {
    const composite = computeKpi3Composite({ level: 3.7, dm: 3.7, leader: 3.8, practice: 3.8 });
    expect(composite).toBe(3.75);
    expect(gradeKpi3(composite)).toBe('B');
  });
});
