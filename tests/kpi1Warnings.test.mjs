import { describe, expect, it } from 'vitest';
import { detectKpi1Warnings } from '../src/utils/kpi1Warnings.js';
import { computeTeamKpi } from '../src/utils/computeTeamKpi.js';

const row = (stored, journal) => ({ kpi1: stored, kpi1Journal: journal });
const base = { work: 14.125, improve: 3.375, leave: 4.5, available: 22, utilization: 100 };

describe('detectKpi1Warnings', () => {
  it('저장값이 일지와 같으면 경고 없음', () => {
    expect(detectKpi1Warnings(row(base, { ...base }))).toEqual([]);
  });

  it('작은 반올림 오차는 무시', () => {
    expect(detectKpi1Warnings(row(base, { ...base, work: 14.1251 }))).toEqual([]);
  });

  it('제출본이 일지와 다르면 drift + 100% 초과', () => {
    const stored = { work: 20.5, improve: 0, leave: 4.5, available: 23, utilization: 108.7 };
    const codes = detectKpi1Warnings(row(stored, base)).map((w) => w.code);
    expect(codes).toEqual(['drift', 'over']);
  });

  it('툴팁 문구가 「일지에서 가져오기」 조치를 안내', () => {
    const stored = { work: 20.5, improve: 0, leave: 4.5, available: 23, utilization: 108.7 };
    detectKpi1Warnings(row(stored, base)).forEach((warning) => {
      expect(warning.message).toContain('일지에서 가져오기');
    });
  });

  it('값은 같아도 100% 초과면 over 만', () => {
    const over = { ...base, available: 20, utilization: 110 };
    expect(detectKpi1Warnings(row(over, { ...over })).map((w) => w.code)).toEqual(['over']);
  });

  it('가용 M/M만 달라도 drift (월 경계 버그 유형)', () => {
    const stored = { ...base, available: 23, utilization: 95.65 };
    expect(detectKpi1Warnings(row(stored, base)).map((w) => w.code)).toEqual(['drift']);
  });

  it('kpi1Journal 없으면 경고 없음', () => {
    expect(detectKpi1Warnings({ kpi1: base })).toEqual([]);
  });
});

describe('computeTeamKpi.kpi1Journal', () => {
  it('월 확정 저장값을 써도 kpi1Journal 은 일지 기준을 유지', () => {
    const result = computeTeamKpi({
      year: 2026,
      monthIndex: 8,
      days: {},
      memberCode: 'B',
      monthly01: { work: 20.5, improve: 0, leave: 4.5, available: 23, status: '제출' },
    });
    expect(result.kpi1.available).toBe(23);
    expect(result.kpi1Journal.available).not.toBe(23);
  });
});
