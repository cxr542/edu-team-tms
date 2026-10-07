import { describe, expect, it } from 'vitest';
import { kpi3CompositeForExport, kpi3GradeForExport } from '../src/utils/kpiExcelExport.js';

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

describe('kpi3GradeForExport — 엑셀 등급 열 (화면과 동일하게 재판정)', () => {
  it('저장된 등급과 무관하게 종합 기준으로 판정', () => {
    expect(kpi3GradeForExport(3.75, 'C')).toBe('B');
    expect(kpi3GradeForExport(3.45, 'D')).toBe('C');
    expect(kpi3GradeForExport(4.25, 'A')).toBe('S');
    expect(kpi3GradeForExport(3.44, 'D')).toBe('D');
  });

  it('종합이 없으면 저장된 등급을 그대로 둔다', () => {
    expect(kpi3GradeForExport(undefined, 'B')).toBe('B');
    expect(kpi3GradeForExport(0, undefined)).toBeUndefined();
  });
});
