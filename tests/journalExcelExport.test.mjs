import { describe, expect, it } from 'vitest';
import { buildJournalExcelRows, journalExcelFileName } from '../src/utils/journalExcelExport.js';

describe('journalExcelExport', () => {
  const categories = { edu: { label: '교육' } };
  const days = {
    '2026-06-02': {
      holiday: false,
      mm: { work: 0.5, improve: 0, leave: 0 },
      tasks: [
        { cat: 'edu', title: '오후 업무', slot: 'pm', plan: 2, actual: 3, done: true },
        { cat: 'edu', title: '오전 업무', slot: 'am', plan: 1, actual: 1, done: false, note: '메모' },
      ],
    },
  };

  it('업무를 오전→오후 순으로 행 변환하고 완료분만 일 요약 실작업에 반영', () => {
    const { taskRows, summaryRows } = buildJournalExcelRows({ days, year: 2026, month: 5, categories });
    const dayRows = taskRows.filter((r) => r[0] === '2026-06-02');
    expect(dayRows.map((r) => r[5])).toEqual(['오전 업무', '오후 업무']);
    expect(dayRows[0][4]).toBe('교육');
    const s = summaryRows.find((r) => r[0] === '2026-06-02');
    expect(s[3]).toBe(2);
    expect(s[4]).toBe(3);
    expect(s[5]).toBe(3);
  });

  it('빈 일은 제외하고 공휴일은 구분 표시', () => {
    const { taskRows } = buildJournalExcelRows({ days: {}, year: 2026, month: 5, categories });
    expect(taskRows.find((r) => r[0] === '2026-06-03')?.[2]).toBe('휴일');
    expect(taskRows.some((r) => r[0] === '2026-06-02')).toBe(false);
  });

  it('파일명 정제', () => {
    expect(journalExcelFileName('김 영호', 2026, 5)).toBe('업무일지_김_영호_2026-06.xlsx');
  });
});
