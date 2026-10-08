import { describe, expect, it } from 'vitest';
import { resolveKpi2Display } from '../src/utils/kpi2Display.js';

describe('resolveKpi2Display', () => {
  it('prefers official over preview', () => {
    const r = resolveKpi2Display({ productivityPct: 90 }, { productivityPct: 110 });
    expect(r.displayPct).toBe(90);
    expect(r.usesPreview).toBe(false);
  });

  it('falls back to preview when official is null', () => {
    const r = resolveKpi2Display({ productivityPct: null }, { productivityPct: 105 });
    expect(r.displayPct).toBe(105);
    expect(r.usesPreview).toBe(true);
  });
});

import { summarizeKpi2ForDisplay } from '../src/utils/kpi2Display.js';

describe('summarizeKpi2ForDisplay — 구성원 일지 상단 집계', () => {
  it('공식 값이 있으면 공식 기준 (100%를 넘어도 자르지 않음)', () => {
    const r = summarizeKpi2ForDisplay(
      { productivityPct: 164.7, planSum: 14, actualSum: 8.5, submittedCount: 2 },
      { productivityPct: 120, planSum: 30, actualSum: 25, submittedCount: 5 }
    );
    expect(r).toEqual({ hasData: true, displayPct: 164.7, usesPreview: false, planSum: 14, actualSum: 8.5, count: 2 });
  });

  it('공식이 없으면 미리보기(제출 전 건 포함)', () => {
    const r = summarizeKpi2ForDisplay(
      { productivityPct: null, planSum: 0, actualSum: 0, submittedCount: 0 },
      { productivityPct: 204.8, planSum: 65, actualSum: 34.5, submittedCount: 9 }
    );
    expect(r.hasData).toBe(true);
    expect(r.usesPreview).toBe(true);
    expect(r.displayPct).toBe(204.8);
    expect(r.planSum).toBe(65);
    expect(r.count).toBe(9);
  });

  it('효과 건이 없으면 값 없음', () => {
    const r = summarizeKpi2ForDisplay({ productivityPct: null }, { productivityPct: null });
    expect(r.hasData).toBe(false);
    expect(r.displayPct).toBeNull();
    expect(r.count).toBe(0);
    expect(summarizeKpi2ForDisplay(undefined, undefined).hasData).toBe(false);
  });
});
