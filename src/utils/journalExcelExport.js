import * as XLSX from 'xlsx';
import { getTaskSlotLabel, sortTasksBySlot } from '../constants/journalTaskSlot';
import { dateKey, getTaskLoggedHours, getTaskMmAxis, pad, sumDayMm } from './journalMm';
import { resolveJournalDay } from './journalHoliday2026';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const TASK_HEADERS = [
  '날짜',
  '요일',
  '구분',
  '시간대',
  '카테고리',
  '업무',
  '메모',
  '계획(h)',
  '실작업(h)',
  '완료',
  'M/M 축',
  '향상 과제',
];
const TASK_COL_WIDTHS = [12, 6, 8, 8, 14, 40, 40, 9, 10, 6, 8, 24];

const SUMMARY_HEADERS = ['날짜', '요일', '구분', '업무 수', '계획(h)', '실작업(h)', '휴가 M/M', '일 M/M'];
const SUMMARY_COL_WIDTHS = [12, 6, 8, 8, 9, 10, 10, 8];

function dayTypeLabel(day) {
  if (day.holiday) return '휴일';
  if ((Number(day.mm?.leave) || 0) > 0) return '휴가';
  return '';
}

/** 월간 일지 → 업무 행 / 일별 요약 행 (순수 함수, 테스트 용이) */
export function buildJournalExcelRows({ days, year, month, categories }) {
  const taskRows = [];
  const summaryRows = [];
  const lastDay = new Date(year, month + 1, 0).getDate();
  const catLabel = (cat) => categories?.[cat]?.label || cat || '';

  for (let d = 1; d <= lastDay; d += 1) {
    const key = dateKey(year, month, d);
    const day = resolveJournalDay(key, days?.[key]);
    const tasks = sortTasksBySlot(day.tasks || []);
    const weekday = DAY_NAMES[new Date(year, month, d).getDay()];
    const type = dayTypeLabel(day);
    if (!tasks.length && !type) continue;

    let plan = 0;
    tasks.forEach((t) => {
      plan += Number(t.plan) || 0;
      taskRows.push([
        key,
        weekday,
        type,
        getTaskSlotLabel(t.slot),
        catLabel(t.cat),
        t.title || '',
        t.note || '',
        Number(t.plan) || 0,
        Number(t.actual) || 0,
        t.done ? 'O' : '',
        getTaskMmAxis(t) === 'improve' ? '향상' : '업무',
        t.improveProjectTitle || '',
      ]);
    });
    if (!tasks.length) taskRows.push([key, weekday, type, '', '', '', '', '', '', '', '', '']);

    const logged = tasks.reduce((sum, t) => sum + getTaskLoggedHours(t), 0);
    summaryRows.push([
      key,
      weekday,
      type,
      tasks.length,
      plan,
      logged,
      Number(day.mm?.leave) || 0,
      day.mm ? sumDayMm(day) : 0,
    ]);
  }
  return { taskRows, summaryRows };
}

function sheetOf(headers, rows, widths, totals) {
  const aoa = [headers, ...rows];
  if (totals) aoa.push(totals);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = widths.map((wch) => ({ wch }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
  return ws;
}

export function journalExcelFileName(memberLabel, year, month) {
  const safe = String(memberLabel || 'member').replace(/[\\/:*?"<>|\s]+/g, '_');
  return `업무일지_${safe}_${year}-${pad(month + 1)}.xlsx`;
}

/** 선택 구성원의 월간 업무일지를 .xlsx로 다운로드 (읽기 전용 — 저장소 변경 없음) */
export function downloadJournalExcel({ days, year, month, categories, memberLabel }) {
  const { taskRows, summaryRows } = buildJournalExcelRows({ days, year, month, categories });
  const sum = (rows, idx) => rows.reduce((s, r) => s + (Number(r[idx]) || 0), 0);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheetOf(TASK_HEADERS, taskRows, TASK_COL_WIDTHS, [
      '합계', '', '', '', '', '', '', sum(taskRows, 7), sum(taskRows, 8), '', '', '',
    ]),
    '업무일지'
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetOf(SUMMARY_HEADERS, summaryRows, SUMMARY_COL_WIDTHS, [
      '합계', '', '', sum(summaryRows, 3), sum(summaryRows, 4), sum(summaryRows, 5), sum(summaryRows, 6), sum(summaryRows, 7),
    ]),
    '일별 요약'
  );
  const fileName = journalExcelFileName(memberLabel, year, month);
  XLSX.writeFile(wb, fileName);
  return { fileName, taskCount: taskRows.length };
}
