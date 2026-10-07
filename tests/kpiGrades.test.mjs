import { describe, expect, it } from 'vitest';
import { computeKpi3Composite, countKpi3ElementsEntered, formatScoreTenth, gradeKpi3, roundScoreToTenth } from '../src/utils/kpiGrades.js';

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

  it('점수가 없거나 0 이하이면 D가 아니라 — (4요소 미입력)', () => {
    expect(gradeKpi3(0)).toBe('—');
    expect(gradeKpi3(-1)).toBe('—');
    expect(gradeKpi3(undefined)).toBe('—');
    expect(gradeKpi3(0.1)).toBe('D');
    expect(gradeKpi3(3.44)).toBe('D');
  });

  it('computeKpi3Composite는 둘째 자리까지 유지(표시용), 등급만 첫째 자리 기준', () => {
    const composite = computeKpi3Composite({ level: 3.7, dm: 3.7, leader: 3.8, practice: 3.8 });
    expect(composite).toBe(3.75);
    expect(gradeKpi3(composite)).toBe('B');
  });
});

describe('formatScoreTenth — 화면 표기', () => {
  it('첫째 자리 문자열, 값 없음은 —', () => {
    expect(formatScoreTenth(3.75)).toBe('3.8');
    expect(formatScoreTenth(3.74)).toBe('3.7');
    expect(formatScoreTenth(4)).toBe('4.0');
    expect(formatScoreTenth(null)).toBe('—');
    expect(formatScoreTenth(NaN)).toBe('—');
  });
});

describe('countKpi3ElementsEntered — 일부 요소 미입력 판정', () => {
  it('0 초과인 요소만 센다', () => {
    expect(countKpi3ElementsEntered({ level: 3.67, dm: 0, leader: 0, practice: 0 })).toBe(1);
    expect(countKpi3ElementsEntered({ level: 3, dm: 4, leader: 3.3, practice: 5 })).toBe(4);
    expect(countKpi3ElementsEntered({})).toBe(0);
    expect(countKpi3ElementsEntered(undefined)).toBe(0);
    expect(countKpi3ElementsEntered({ level: '', dm: null, leader: undefined, practice: 'x' })).toBe(0);
  });
});
