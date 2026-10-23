import * as XLSX from 'xlsx';
import { getTaskSlotLabel, sortTasksBySlot } from '../constants/journalTaskSlot';
import { dateKey, getTaskLoggedHours, getTaskMmAxis, pad, sumDayMm } from './journalMm';
import { resolveJournalDay } from './journalHoliday2026';
import { findImproveProject } from '../constants/improveProjects';
import { getKpi2BaselineHours, hasKpi2EffectEnabled } from './computeTeamKpi';

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
  '효과 건',
  'AI 미적용 기준시간(h)',
];
const TASK_COL_WIDTHS = [12, 6, 8, 8, 14, 40, 40, 9, 10, 6, 8, 24, 8, 20];

const SUMMARY_HEADERS = ['날짜', '요일', '구분', '업무 수', '계획(h)', '실작업(h)', '휴가 M/M', '일 M/M'];
const SUMMARY_COL_WIDTHS = [12, 6, 8, 8, 9, 10, 10, 8];

function dayTypeLabel(day) {
  if (day.holiday) return '휴일';
  if ((Number(day.mm?.leave) || 0) > 0) return '휴가';
  return '';
}

/** 월간 일지 → 업무 행 / 일별 요약 행 (순수 함수, 테스트 용이) */
export function buildJournalExcelRows({ days, year, month, categories, improveProjects = [] }) {
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
      const effect = hasKpi2EffectEnabled(t);
      const effectProject = effect ? findImproveProject(improveProjects, t.kpi2Effect?.projectId) : null;
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
        t.improveProjectTitle || effectProject?.name || '',
        effect ? 'O' : '',
        effect ? getKpi2BaselineHours(t) : '',
      ]);
    });
    if (!tasks.length) taskRows.push([key, weekday, type, '', '', '', '', '', '', '', '', '', '', '']);

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
export function downloadJournalExcel({ days, year, month, categories, memberLabel, improveProjects }) {
  const { taskRows, summaryRows } = buildJournalExcelRows({ days, year, month, categories, improveProjects });
  const sum = (rows, idx) => rows.reduce((s, r) => s + (Number(r[idx]) || 0), 0);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheetOf(TASK_HEADERS, taskRows, TASK_COL_WIDTHS, [
      '합계', '', '', '', '', '', '', sum(taskRows, 7), sum(taskRows, 8), '', '', '', '', '',
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

const TEAM_SUMMARY_HEADERS = ['구성원', '기록 일수', '업무 수', '계획(h)', '실작업(h)', '휴가 M/M', '일 M/M'];
const TEAM_SUMMARY_COL_WIDTHS = [14, 9, 8, 9, 10, 10, 8];

/** 시트명: 엑셀 제한(31자, \/?*[]: 금지) 반영 + 중복 방지 */
function uniqueSheetName(label, used) {
  const base = String(label || '구성원').replace(/[\\/?*[\]:]/g, '_').slice(0, 28) || '구성원';
  let name = base;
  for (let i = 2; used.has(name); i += 1) name = `${base}_${i}`;
  used.add(name);
  return name;
}

export function teamJournalExcelFileName(year, month) {
  return `업무일지_팀전체_${year}-${pad(month + 1)}.xlsx`;
}

/**
 * 팀 전체(구성원별 시트) 월간 업무일지 다운로드 — 관리자 전용 UI에서 호출.
 * members: [{ label, days, categories }]. 이 브라우저 저장소에 있는 값만 담는다(읽기 전용).
 */
export function downloadTeamJournalExcel({ members, year, month, improveProjects }) {
  const wb = XLSX.utils.book_new();
  const used = new Set(['팀 요약']);
  const sum = (rows, idx) => rows.reduce((s, r) => s + (Number(r[idx]) || 0), 0);
  const built = members.map((m) => ({
    ...m,
    ...buildJournalExcelRows({ days: m.days, year, month, categories: m.categories, improveProjects }),
  }));

  const teamRows = built.map((m) => [
    m.label,
    m.summaryRows.length,
    sum(m.summaryRows, 3),
    sum(m.summaryRows, 4),
    sum(m.summaryRows, 5),
    sum(m.summaryRows, 6),
    sum(m.summaryRows, 7),
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    sheetOf(TEAM_SUMMARY_HEADERS, teamRows, TEAM_SUMMARY_COL_WIDTHS, [
      '합계', '', sum(teamRows, 2), sum(teamRows, 3), sum(teamRows, 4), sum(teamRows, 5), sum(teamRows, 6),
    ]),
    '팀 요약'
  );
  built.forEach((m) => {
    XLSX.utils.book_append_sheet(
      wb,
      sheetOf(TASK_HEADERS, m.taskRows, TASK_COL_WIDTHS, [
        '합계', '', '', '', '', '', '', sum(m.taskRows, 7), sum(m.taskRows, 8), '', '', '', '', '',
      ]),
      uniqueSheetName(m.label, used)
    );
  });
  const fileName = teamJournalExcelFileName(year, month);
  XLSX.writeFile(wb, fileName);
  return {
    fileName,
    members: built.map((m) => ({ label: m.label, taskCount: m.taskRows.length })),
  };
}
