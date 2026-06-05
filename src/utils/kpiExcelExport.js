import * as XLSX from 'xlsx';
import {
  KPI_01C_HEADERS,
  KPI_01_HEADERS,
  KPI_02_HEADERS,
  KPI_JOURNAL_MEMBER,
  KPI_SHEET_01,
  KPI_SHEET_01C,
  KPI_SHEET_02,
  KPI_SHEET_03,
  TEAM_KPI_MEMBERS,
} from '../constants/kpiSchema';
import { JOURNAL_LINKED_MEMBER_CODE } from '../constants/kpiMembers';
import { monthKey, quarterKey } from '../constants/kpiOperationalStore';
import {
  buildKpi01cRows,
  buildKpi01MonthlyRow,
  buildKpi02EffectRows,
} from './computeTeamKpi';
import { computeUtilization } from './kpiMonthlyClose';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { monthlyFinalScore } from './competencyScore';
import { pad } from './journalMm';

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

/** 분석용 xlsx 파일명 (타임스탬프) */
export function buildKpiAnalysisFilename(year, monthIndex) {
  const now = new Date();
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `교육팀_KPI_분석-${year}-${pad(monthIndex + 1)}-${ts}.xlsx`;
}

/** @deprecated */
export function buildKpiExportFilename(year, monthIndex, { overwriteMonthly = false } = {}) {
  if (overwriteMonthly) {
    return `교육팀_KPI_TMS_${year}-${pad(monthIndex + 1)}.xlsx`;
  }
  return buildKpiAnalysisFilename(year, monthIndex);
}

export { buildKpi01cRows, buildKpi02EffectRows };

const KPI_03_HEADERS = ['연도', '분기', '구성원', '월', '유형', '메모'];
const KPI_03_Q_HEADERS = ['연도', '분기', '구성원', '레벨', '다면N', '리더', '실전', '종합', '등급', '확정', 'level자동'];
const KPI_04_COMP_HEADERS = [
  '평가월',
  '구성원',
  '직군',
  '자체종합',
  '팀장종합',
  '월간KPI연계',
  '자체확정',
  '팀장확정',
];

/**
 * TMS SoT → 분석용 Excel (01c, 01, 02, 03, 메타)
 */
export function exportKpiAnalysisWorkbook({
  year,
  monthIndex,
  days,
  kpiOperational,
  improveProjects = [],
  filename,
}) {
  const memos = kpiOperational?.kpiWeekMemos || {};
  const kpi2RowStatus = kpiOperational?.kpi2RowStatus || {};
  const ym = monthKey(year, monthIndex);
  const yq = quarterKey(year, monthIndex);

  const rows01c = buildKpi01cRows(year, monthIndex, days, memos, JOURNAL_LINKED_MEMBER_CODE);
  const rows02 = buildKpi02EffectRows(
    year,
    monthIndex,
    days,
    improveProjects,
    JOURNAL_LINKED_MEMBER_CODE,
    kpi2RowStatus
  );

  const rows01 = TEAM_KPI_MEMBERS.map((m) => {
    const monthly01 = kpiOperational?.months?.[ym]?.[m.code]?.monthly01;
    if (!monthly01) return null;
    const { utilization } = computeUtilization(monthly01);
    return buildKpi01MonthlyRow(year, monthIndex, m.code, monthly01, utilization);
  }).filter(Boolean);

  const rows03Memos = [];
  const rows03Q = [];
  const rows04Comp = [];
  TEAM_KPI_MEMBERS.forEach((m) => {
    const rec = kpiOperational?.quarters?.[yq]?.[m.code];
    (rec?.memos || []).forEach((memo) => {
      rows03Memos.push({
        연도: year,
        분기: yq.split('-')[1],
        구성원: m.code,
        월: memo.month,
        유형: memo.type,
        메모: memo.text,
      });
    });
    const q = rec?.quarter;
    if (q) {
      rows03Q.push({
        연도: year,
        분기: yq.split('-')[1],
        구성원: m.code,
        레벨: q.level,
        다면N: q.dm,
        리더: q.leader,
        실전: q.practice,
        종합: q.composite,
        등급: q.grade,
        확정: q.locked ? 'Y' : 'N',
        level자동: q.levelAuto ? 'Y' : 'N',
      });
    }

    const compRec = kpiOperational?.competencyMonths?.[ym]?.[m.code];
    if (compRec) {
      rows04Comp.push({
        평가월: ym,
        구성원: m.code,
        직군: compRec.roleId,
        자체종합: compRec.self?.computed?.proposed ?? '',
        팀장종합: compRec.manager?.computed?.proposed ?? '',
        월간KPI연계: monthlyFinalScore(
          compRec.self?.computed?.proposed,
          compRec.manager?.computed?.proposed,
          COMPETENCY_USE_4060
        ),
        자체확정: compRec.selfLocked ? 'Y' : 'N',
        팀장확정: compRec.managerLocked ? 'Y' : 'N',
      });
    }
  });

  const wb = XLSX.utils.book_new();
  const meta = [[`TMS KPI 분석 export · ${year}년 ${monthIndex + 1}월 · SoT=TMS · ${new Date().toISOString()}`]];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), '00_메타');
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(KPI_01C_HEADERS, rows01c, [`KPI1 01c — ${KPI_JOURNAL_MEMBER.displayName}`], [1]),
    KPI_SHEET_01C
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(KPI_01_HEADERS, rows01, [`KPI1 월확정 — ${year}-${pad(monthIndex + 1)}`]),
    KPI_SHEET_01
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheetFromRows(KPI_02_HEADERS, rows02, [`KPI2 효과 건 — ${year}년 ${monthIndex + 1}월`], [0]),
    KPI_SHEET_02
  );
  if (rows03Memos.length) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(KPI_03_HEADERS, rows03Memos, ['KPI3 월 메모']),
      `${KPI_SHEET_03}_메모`
    );
  }
  if (rows03Q.length) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(KPI_03_Q_HEADERS, rows03Q, ['KPI3 분기 확정']),
      `${KPI_SHEET_03}_분기`
    );
  }
  if (rows04Comp.length) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetFromRows(KPI_04_COMP_HEADERS, rows04Comp, ['04_역량월간']),
      '04_역량월간'
    );
  }

  const outName = filename || buildKpiAnalysisFilename(year, monthIndex);
  XLSX.writeFile(wb, outName);
  return {
    filename: outName,
    rows01c: rows01c.length,
    rows01: rows01.length,
    rows02: rows02.length,
    rows03: rows03Memos.length + rows03Q.length,
    rows04Comp: rows04Comp.length,
  };
}

/** @deprecated — exportKpiAnalysisWorkbook 사용 */
export function exportKpiJournalWorkbook(opts) {
  const { kpiWeekMemos, ...rest } = opts;
  return exportKpiAnalysisWorkbook({
    ...rest,
    kpiOperational: {
      kpiWeekMemos: kpiWeekMemos || {},
      kpi2RowStatus: {},
      months: {},
      quarters: {},
      competencyMonths: {},
    },
  });
}
