import { KPI_JOURNAL_MEMBER, KPI_SHEET_01C, KPI_SHEET_02, KPI_01C_HEADERS, KPI_02_HEADERS } from './kpiSchema';
import { JOURNAL_CATS } from './journalCategories';
import { getTaskLoggedHours, getTaskMmAxis, hoursToMm } from '../utils/journalMm';
import { LEAVE_MEMO_TASK_RE } from '../utils/journalLeavePresets';
import { getTaskSlotLabel } from './journalTaskSlot';
import { findImproveProject } from './improveProjects';
import { buildKpi01cRows, buildKpi02EffectRows, getKpi2BaselineHours, isKpi2EffectTask } from '../utils/computeTeamKpi';
import { KPI1_NAME, KPI2_NAME } from './kpiDisplayNames';

export const KPI_SYSTEM_LABEL = '교육팀 KPI 운영';

/** 일지 연계 상세 가이드 (public 정적 파일) */
export const KPI_JOURNAL_LINKAGE_GUIDE_PATH = '/docs/KPI-일지-TMS-연계-가이드.md';

export const KPI_LINKAGE_ROWS = [
  {
    journal: '일별 업무 (실작업 h, M/D 구분)',
    kpi: `${KPI1_NAME} — 업무MM / 생산향상MM`,
    sheet: KPI_SHEET_01C,
    note: '실작업÷8(M/D) · 완료 건 · 주/월 합산은 KPI1 M/M',
  },
  {
    journal: 'KPI 탭 — 주간메모 (별도 입력)',
    kpi: `${KPI1_NAME} — 주간메모`,
    sheet: KPI_SHEET_01C,
    note: '일지 금주(요약)와 분리 · 엑셀 01c 한두 줄',
  },
  {
    journal: `${KPI2_NAME} 효과 건 (기준h·실작업·향상과제)`,
    kpi: `${KPI2_NAME} — 도구 활용 단축 효과`,
    sheet: KPI_SHEET_02,
    note: 'kpi2Effect.enabled · 완료 건 · 생산성=기준÷실작업',
  },
  {
    journal: '휴일 M/D · 휴일 메모',
    kpi: `${KPI1_NAME} — 휴일MM`,
    sheet: KPI_SHEET_01C,
    note: `휴일 메모 업무는 ${KPI2_NAME} 제외`,
  },
];

export function summarizeMonthKpiExport(year, monthIndex, days, kpiWeekMemos = {}, improveProjects = []) {
  const rows01c = buildKpi01cRows(year, monthIndex, days, kpiWeekMemos);
  const rows02 = buildKpi02EffectRows(year, monthIndex, days, improveProjects);
  return {
    rows01c: rows01c.length,
    rows02: rows02.length,
    member: KPI_JOURNAL_MEMBER,
  };
}

/** 업무 1건 → KPI1·KPI2 연계 요약 */
export function describeTaskKpiLinkage(task, dayKey, improveProjects = []) {
  if (!task || LEAVE_MEMO_TASK_RE.test(task.title || '')) return null;

  const axis = getTaskMmAxis(task);
  const enteredActual = Number(task.actual) || 0;
  const logged = getTaskLoggedHours(task);
  const plan = Number(task.plan) || 0;
  const mm = hoursToMm(logged);
  const axisLabel = axis === 'improve' ? '생산향상' : '업무';
  const catLabel = JOURNAL_CATS[task.cat]?.label || task.cat;

  const kpi1 =
    logged > 0
      ? `${axisLabel}MD +${mm.toFixed(2)} (${logged}h÷8)`
      : enteredActual > 0 && !task.done
        ? `${axisLabel}MD — ${enteredActual}h 입력됨 (완료 체크 시 반영)`
        : plan > 0
          ? `${axisLabel}MD — 계획 ${plan}h (완료·실작업 입력 시 반영)`
          : null;

  let kpi2 = null;
  if (isKpi2EffectTask(task)) {
    const baseline = getKpi2BaselineHours(task);
    const project = findImproveProject(improveProjects, task.kpi2Effect?.projectId);
    const effectActual =
      logged > 0
        ? `${logged}h`
        : enteredActual > 0 && !task.done
          ? `${enteredActual}h(미완료)`
          : '0h';
    kpi2 = `효과건 · 기준${baseline}h→${effectActual}${project ? ` · ${project.name}` : ''}`;
  } else if (axis === 'improve') {
    kpi2 = `향상 투자 — ${KPI2_NAME} 효과 건 아님 (과제 개발·개선)`;
  }

  const slot = getTaskSlotLabel(task.slot);
  const commentBits = [slot, task.note, catLabel ? `카테고리:${catLabel}` : ''].filter(Boolean);

  return {
    axis,
    axisLabel,
    isEffect: isKpi2EffectTask(task),
    kpi1Sheet: KPI_SHEET_01C,
    kpi2Sheet: KPI_SHEET_02,
    kpi1,
    kpi2,
    kpi2Comment: commentBits.join(' · '),
    dayKey,
  };
}

export function rowsToTsv(headers, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (s.includes('\t') || s.includes('\n') || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join('\t')];
  rows.forEach((row) => {
    lines.push(headers.map((h) => escape(row[h])).join('\t'));
  });
  return lines.join('\n');
}

export async function copyKpiSheetToClipboard(headers, rows) {
  const tsv = rowsToTsv(headers, rows);
  await navigator.clipboard.writeText(tsv);
  return tsv;
}

export { KPI_01C_HEADERS, KPI_02_HEADERS };
