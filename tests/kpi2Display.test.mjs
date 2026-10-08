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

import { kpi2TileTooltip } from '../src/utils/kpi2Display.js';

describe('kpi2TileTooltip — 상세는 툴팁으로', () => {
  const rule = 'KPI 지표 2 — 이 달 KPI2 효과 건의 계획 시간 합 ÷ 실작업 시간 합 × 100';
  it('공식 값: 산식 + 계획·실적·건수', () => {
    const tip = kpi2TileTooltip({ hasData: true, planSum: 14, actualSum: 8.5, count: 2, usesPreview: false });
    expect(tip).toBe(`${rule}\n계획 14.0h ÷ 실적 8.5h · 2건`);
  });
  it('미리보기: 제출 전 건 포함 표시', () => {
    const tip = kpi2TileTooltip({ hasData: true, planSum: 8, actualSum: 5, count: 1, usesPreview: true });
    expect(tip).toBe(`${rule}\n계획 8.0h ÷ 실적 5.0h · 1건 · 제출 전 건 포함`);
  });
  it('효과 건이 없으면 안내', () => {
    expect(kpi2TileTooltip({ hasData: false })).toBe(`${rule}\n효과 건 없음`);
    expect(kpi2TileTooltip(undefined)).toBe(`${rule}\n효과 건 없음`);
  });
});
