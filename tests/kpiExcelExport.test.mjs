import { describe, expect, it } from 'vitest';
import { kpi3CompositeForExport } from '../src/utils/kpiExcelExport.js';

describe('kpi3CompositeForExport — 엑셀 종합 열 (정의서 v6)', () => {
  it('첫째 자리 숫자로 반올림', () => {
    expect(kpi3CompositeForExport(3.75)).toBe(3.8);
    expect(kpi3CompositeForExport(3.81)).toBe(3.8);
    expect(kpi3CompositeForExport(3.21)).toBe(3.2);
    expect(kpi3CompositeForExport(4)).toBe(4);
  });

  it('값 없음은 그대로 둔다', () => {
    expect(kpi3CompositeForExport(undefined)).toBeUndefined();
    expect(kpi3CompositeForExport(null)).toBeNull();
    expect(kpi3CompositeForExport('')).toBe('');
  });
});
