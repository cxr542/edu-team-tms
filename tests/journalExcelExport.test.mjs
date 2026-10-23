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

describe('teamJournalExcelFileName', () => {
  it('팀 전체 파일명', async () => {
    const { teamJournalExcelFileName } = await import('../src/utils/journalExcelExport.js');
    expect(teamJournalExcelFileName(2026, 5)).toBe('업무일지_팀전체_2026-06.xlsx');
  });
});

describe('journalExcelExport KPI2 효과 건', () => {
  it('효과 건은 향상 과제명·AI 미적용 기준시간을 포함', () => {
    const days = {
      '2026-06-02': {
        tasks: [
          { cat: 'ai', title: 'AI 초안', plan: 1, actual: 1, done: true, kpi2Effect: { enabled: true, projectId: 'p1', baselineHours: 4 } },
          { cat: 'ai', title: 'AI 기준 미입력', plan: 2, actual: 1, done: true, kpi2Effect: { enabled: true } },
          { cat: 'edu', title: '일반', plan: 1, actual: 1, done: true },
        ],
      },
    };
    const { taskRows } = buildJournalExcelRows({
      days, year: 2026, month: 5, categories: {}, improveProjects: [{ id: 'p1', name: '교안 자동화' }],
    });
    const byTitle = Object.fromEntries(taskRows.map((r) => [r[5], r]));
    expect(byTitle['AI 초안'].slice(11)).toEqual(['교안 자동화', 'O', 4]);
    expect(byTitle['AI 기준 미입력'].slice(11)).toEqual(['', 'O', 2]);
    expect(byTitle['일반'].slice(11)).toEqual(['', '', '']);
  });
});
