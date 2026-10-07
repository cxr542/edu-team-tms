import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { KPI_01C_HEADERS, KPI_01_HEADERS, kpiHeaderLabel } from '../src/constants/kpiSchema.js';
import { rowsToTsv } from '../src/constants/kpiLinkage.js';
import { sheetFromRows } from '../src/utils/kpiExcelExport.js';

describe('KPI 헤더 라벨 — M/M → M/D (표시만, 행 키는 그대로)', () => {
  it('kpiHeaderLabel', () => {
    expect(kpiHeaderLabel('업무MM')).toBe('업무MD');
    expect(kpiHeaderLabel('생산향상MM')).toBe('생산향상MD');
    expect(kpiHeaderLabel('휴일MM')).toBe('휴일MD');
    expect(kpiHeaderLabel('가용MM')).toBe('가용MD');
    expect(kpiHeaderLabel('주간메모')).toBe('주간메모');
  });

  it('헤더 상수(행 키)는 호환을 위해 그대로', () => {
    expect(KPI_01C_HEADERS).toContain('업무MM');
    expect(KPI_01_HEADERS).toContain('가용MM');
  });

  it('복사용 TSV: 헤더는 MD, 값은 기존 키로 읽는다', () => {
    const tsv = rowsToTsv(['주시작일', '업무MM', '휴일MM'], [{ 주시작일: '2026-07-06', 업무MM: 4.5, 휴일MM: 1 }]);
    expect(tsv.split('\n')[0]).toBe('주시작일\t업무MD\t휴일MD');
    expect(tsv.split('\n')[1]).toBe('2026-07-06\t4.5\t1');
  });

  it('엑셀 시트: 헤더 행은 MD, 값은 기존 키로 읽는다', () => {
    const ws = sheetFromRows(['구성원', '업무MM', '가용MM'], [{ 구성원: 'A', 업무MM: 17, 가용MM: 22 }], ['제목']);
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
    expect(aoa[1]).toEqual(['구성원', '업무MD', '가용MD']);
    expect(aoa[2]).toEqual(['A', 17, 22]);
  });
});
