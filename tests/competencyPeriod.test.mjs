import { describe, expect, it } from 'vitest';
import {
  firstMonthIndexOfQuarter,
  quarterFromMonthIndex,
  resolveCompetencyPeriod,
  yqFromYearQuarter,
} from '../src/hooks/useCompetencyPeriod.js';

describe('useCompetencyPeriod helpers', () => {
  it('quarterFromMonthIndex — 6월(5) → 2분기', () => {
    expect(quarterFromMonthIndex(5)).toBe(2);
    expect(quarterFromMonthIndex(0)).toBe(1);
    expect(quarterFromMonthIndex(11)).toBe(4);
  });

  it('firstMonthIndexOfQuarter — 2분기 → 3(4월)', () => {
    expect(firstMonthIndexOfQuarter(2)).toBe(3);
  });

  it('yqFromYearQuarter', () => {
    expect(yqFromYearQuarter(2026, 2)).toBe('2026-2Q');
  });

  it('resolveCompetencyPeriod — quarter URL 우선', () => {
    expect(resolveCompetencyPeriod({ year: '2026', quarter: '2', month: '6' })).toEqual({
      year: 2026,
      quarter: 2,
    });
  });

  it('resolveCompetencyPeriod — month만 있으면 derive', () => {
    expect(resolveCompetencyPeriod({ year: '2026', month: '6' })).toEqual({
      year: 2026,
      quarter: 2,
    });
  });

  it('resolveCompetencyPeriod — invalid quarter falls back to month', () => {
    expect(resolveCompetencyPeriod({ year: '2026', quarter: '9', month: '3' })).toEqual({
      year: 2026,
      quarter: 1,
    });
  });
});
