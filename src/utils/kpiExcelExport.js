import * as XLSX from 'xlsx';
import {
  KPI_01C_HEADERS,
  KPI_02_HEADERS,
  KPI_JOURNAL_MEMBER,
  KPI_SHEET_01C,
  KPI_SHEET_02,
} from '../constants/kpiSchema';
import { resolveWeekColumnText } from '../constants/journalCategories';
import { LEAVE_MEMO_TASK_RE } from './journalLeavePresets';
import { getWeeksInMonth, pad } from './journalMm';

function quarterFromMonth(month1to12) {
  if (month1to12 <= 3) return '1Q';
  if (month1to12 <= 6) return '2Q';
  if (month1to12 <= 9) return '3Q';
  return '4Q';
}

function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d, date: new Date(y, m - 1, d) };
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/** 01c: 주차별 M/M 합(월~금) + 금주 요약 텍스트 */
export function buildKpi01cRows(year, monthIndex, days, weekSummaries = {}) {
  const weeks = getWeeksInMonth(year, monthIndex);
  const quarter = quarterFromMonth(monthIndex + 1);

  return weeks.map((week) => {
    const monday = week.days[0];
    const weekStartKey = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
    let work = 0;
    let improve = 0;
    let leave = 0;

    week.days.forEach((d) => {
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const day = days[key];
      if (!day) return;
      work += Number(day.mm?.work) || 0;
      improve += Number(day.mm?.improve) || 0;
      leave += Number(day.mm?.leave) || 0;
    });

    const memo = resolveWeekColumnText(
      weekSummaries[week.key] ?? weekSummaries[`w${week.index}`]
    );

    return {
      연도: monday.getFullYear(),
      주시작일: parseDayKey(weekStartKey).date,
      구성원: KPI_JOURNAL_MEMBER.code,
      업무MM: round4(work),
      생산향상MM: round4(improve),
      휴일MM: round4(leave),
      주간메모: memo,
      해당월: monthIndex + 1,
      분기: quarter,
    };
  });
}

/** 02: 월 내 업무 항목(실작업·계획) */
export function buildKpi02Rows(year, monthIndex, days) {
  const prefix = `${year}-${pad(monthIndex + 1)}`;
  const quarter = quarterFromMonth(monthIndex + 1);
  const rows = [];

  Object.entries(days).forEach(([key, day]) => {
    if (!key.startsWith(prefix)) return;
    const { y, m, d, date } = parseDayKey(key);

    (day.tasks || []).forEach((task) => {
      if (LEAVE_MEMO_TASK_RE.test(task.title)) return;
      const plan = Number(task.plan) || 0;
      const actual = Number(task.actual) || 0;
      if (plan === 0 && actual === 0) return;

      const productivity = actual > 0 ? round4(plan / actual) : '';

      rows.push({
        완료일: date,
        연도: y,
        월: m,
        분기: quarter,
        구성원: KPI_JOURNAL_MEMBER.code,
        업무명: task.title,
        계획시간: plan,
        실작업시간: actual,
        '생산성%': productivity,
        계획승인: task.approved === false ? 'N' : 'Y',
        상태: task.done ? '제출' : '작성중',
        코멘트: [task.note, JOURNAL_CAT_LABEL(task.cat)].filter(Boolean).join(' · '),
        승인자: '',
        승인일: '',
      });
    });
  });

  rows.sort((a, b) => a.완료일 - b.완료일 || a.업무명.localeCompare(b.업무명));
  return rows;
}

function JOURNAL_CAT_LABEL(cat) {
  const map = { edu: '교육', prep: '교육준비', ai: 'AI', other: '기타' };
  return map[cat] ? `카테고리:${map[cat]}` : '';
}

function sheetFromRows(headers, rows, titleRow, dateColumnIndexes = []) {
  const aoa = [titleRow, headers];
  rows.forEach((row) => {
    aoa.push(headers.map((h) => row[h] ?? ''));
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let r = 2; r < aoa.length; r += 1) {
    dateColumnIndexes.forEach((colIdx) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c: colIdx })];
      if (cell && cell.v instanceof Date) {
        cell.t = 'd';
        cell.z = 'yyyy-mm-dd';
      }
    });
  }

  ws['!cols'] = headers.map((h) => ({
    wch: Math.max(10, h.length + 2, h === '주간메모' || h === '업무명' || h === '코멘트' ? 36 : 12),
  }));

  return ws;
}

export function buildKpiExportFilename(year, monthIndex) {
  const now = new Date();
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `교육팀_KPI_TMS_${year}-${pad(monthIndex + 1)}-${ts}.xlsx`;
}

/**
 * TMS 일지 → KPI 운영 엑셀 (01c 주간메모 + 02 KPI2 입력 시트)
 * 기존 `교육팀_KPI_운영_2026.xlsx`에 붙여넣거나 단독으로 사용
 */
export function exportKpiJournalWorkbook({
  year,
  monthIndex,
  days,
  weekSummaries = {},
  filename,
}) {
  const rows01c = buildKpi01cRows(year, monthIndex, days, weekSummaries);
  const rows02 = buildKpi02Rows(year, monthIndex, days);

  const wb = XLSX.utils.book_new();

  const ws01c = sheetFromRows(
    KPI_01C_HEADERS,
    rows01c,
    [`KPI1 주간 메모 — TMS export (${KPI_JOURNAL_MEMBER.displayName} / ${KPI_JOURNAL_MEMBER.code})`],
    [1]
  );
  const ws02 = sheetFromRows(
    KPI_02_HEADERS,
    rows02,
    [`KPI2 입력 — TMS export (${year}년 ${monthIndex + 1}월)`],
    [0]
  );

  XLSX.utils.book_append_sheet(wb, ws01c, KPI_SHEET_01C);
  XLSX.utils.book_append_sheet(wb, ws02, KPI_SHEET_02);

  const outName = filename || buildKpiExportFilename(year, monthIndex);
  XLSX.writeFile(wb, outName);
  return { filename: outName, rows01c: rows01c.length, rows02: rows02.length };
}
