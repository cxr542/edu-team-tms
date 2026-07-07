import { JOURNAL_LINKED_MEMBER_CODE } from '../constants/kpiMembers.js';
import { findKpiMember } from '../constants/kpiSchema.js';
import { KPI_STATUS } from '../constants/kpiStatuses.js';
import { readKpi2RowStatus } from '../constants/kpiOperationalStore.js';
import { getTaskSlotLabel } from '../constants/journalTaskSlot.js';
import { LEAVE_MEMO_TASK_RE } from './journalLeavePresets.js';
import { isMonthly01ContentUnset } from './kpiMonthlyClose.js';
import {
  getDayAvailableMm,
  getTaskLoggedHours,
  getTaskMmAxis,
  getWeeksInMonth,
  pad,
  roundMm,
} from './journalMm.js';

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

export function isKpi2EffectTask(task) {
  return Boolean(task?.kpi2Effect?.enabled);
}

export function getKpi2BaselineHours(task) {
  const baseline = Number(task?.kpi2Effect?.baselineHours);
  if (baseline > 0) return baseline;
  return Number(task?.plan) || 0;
}

function resolveKpiWeekMemo(kpiWeekMemos, week) {
  const raw = kpiWeekMemos[week.key] ?? kpiWeekMemos[`w${week.index}`] ?? '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/** 01c: 주차별 M/D 합 + KPI 탭 주간메모 (일지 금주와 별도) */
export function buildKpi01cRows(year, monthIndex, days, kpiWeekMemos = {}, memberCode = JOURNAL_LINKED_MEMBER_CODE) {
  const member = findKpiMember(memberCode) || { code: memberCode, displayName: memberCode };
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

    const memo = resolveKpiWeekMemo(kpiWeekMemos, week);

    return {
      연도: monday.getFullYear(),
      주시작일: parseDayKey(weekStartKey).date,
      weekStartKey,
      weekKey: week.key,
      구성원: member.code,
      업무MM: round4(work),
      생산향상MM: round4(improve),
      휴일MM: round4(leave),
      주간메모: memo,
      해당월: monthIndex + 1,
      분기: quarter,
    };
  });
}

function JOURNAL_CAT_LABEL(cat) {
  const map = { edu: '교육', prep: '교육준비', ai: 'AI', other: '기타' };
  return map[cat] ? `카테고리:${map[cat]}` : '';
}

function buildEffectComment(task, projectName) {
  const baseline = getKpi2BaselineHours(task);
  const actual = getTaskLoggedHours(task);
  const saved = baseline > 0 && actual > 0 ? round4(baseline - actual) : 0;
  return [
    projectName ? `향상과제:${projectName}` : '',
    baseline > 0 ? `기준${baseline}h` : '',
    saved > 0 ? `절감${saved}h` : '',
    getTaskSlotLabel(task.slot),
    task.note,
    JOURNAL_CAT_LABEL(task.cat),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** KPI2: kpi2Effect.enabled 건만 (향상 MD 투자·일반 업무 제외) */
export function buildKpi02EffectRows(
  year,
  monthIndex,
  days,
  improveProjects = [],
  memberCode = JOURNAL_LINKED_MEMBER_CODE,
  kpi2RowStatus = {}
) {
  const member = findKpiMember(memberCode) || { code: memberCode, displayName: memberCode };
  const prefix = `${year}-${pad(monthIndex + 1)}`;
  const quarter = quarterFromMonth(monthIndex + 1);
  const projectById = Object.fromEntries(improveProjects.map((p) => [p.id, p]));
  const rows = [];

  Object.entries(days).forEach(([key, day]) => {
    if (!key.startsWith(prefix)) return;
    const { y, m, date } = parseDayKey(key);

    (day.tasks || []).forEach((task) => {
      if (LEAVE_MEMO_TASK_RE.test(task.title)) return;
      if (!isKpi2EffectTask(task)) return;

      const baseline = getKpi2BaselineHours(task);
      const actual = getTaskLoggedHours(task);
      if (baseline === 0 && actual === 0) return;

      const project = projectById[task.kpi2Effect?.projectId];
      const productivity =
        actual > 0 && baseline > 0 ? round4((baseline / actual) * 100) : '';
      const opStatus = readKpi2RowStatus(kpi2RowStatus, member.code, key, task.id).value;
      const status = opStatus?.status || KPI_STATUS.DRAFT;

      rows.push({
        dayKey: key,
        taskId: task.id,
        projectId: task.kpi2Effect?.projectId || '',
        완료일: date,
        연도: y,
        월: m,
        분기: quarter,
        구성원: member.code,
        업무명: task.title,
        계획시간: baseline,
        실작업시간: actual,
        '생산성%': productivity,
        계획승인: task.approved === false ? 'N' : 'Y',
        상태: status,
        코멘트: buildEffectComment(task, project?.name),
        승인자: opStatus?.approver || '',
        승인일: opStatus?.approvedAt ? String(opStatus.approvedAt).slice(0, 10) : '',
        rejectReason: opStatus?.rejectReason || '',
      });
    });
  });

  rows.sort((a, b) => a.완료일 - b.완료일 || a.업무명.localeCompare(b.업무명));
  return rows;
}

/** @deprecated 전 업무 export — KPI2 효과 건 전용으로 buildKpi02EffectRows 사용 */
export function buildKpi02Rows(year, monthIndex, days) {
  return buildKpi02EffectRows(year, monthIndex, days, []);
}

export function computeMonthKpi1Totals(year, monthIndex, days) {
  const prefix = `${year}-${pad(monthIndex + 1)}`;
  let work = 0;
  let improve = 0;
  let leave = 0;
  let available = 0;

  Object.entries(days).forEach(([key, day]) => {
    if (!key.startsWith(prefix)) return;
    work += Number(day.mm?.work) || 0;
    improve += Number(day.mm?.improve) || 0;
    leave += Number(day.mm?.leave) || 0;
    available += getDayAvailableMm(day);
  });

  work = round4(work);
  improve = round4(improve);
  leave = round4(leave);
  available = round4(available);
  const total = round4(work + improve + leave);
  const utilization =
    available > 0 ? round4((total / available) * 100) : null;

  return { work, improve, leave, available, total, utilization };
}

export function computeMonthKpi2Summary(effectRows, approvedOnly = true) {
  const submitted = effectRows.filter((r) => {
    const okStatus = approvedOnly ? r.상태 === KPI_STATUS.APPROVED : r.상태 === KPI_STATUS.SUBMITTED || r.상태 === KPI_STATUS.APPROVED;
    return okStatus && Number(r.실작업시간) > 0;
  });
  const planSum = submitted.reduce((s, r) => s + Number(r.계획시간), 0);
  const actualSum = submitted.reduce((s, r) => s + Number(r.실작업시간), 0);
  const productivity = actualSum > 0 ? round4((planSum / actualSum) * 100) : null;
  return {
    effectCount: effectRows.length,
    submittedCount: submitted.length,
    planSum: round4(planSum),
    actualSum: round4(actualSum),
    productivityPct: productivity,
  };
}

export function buildKpi01MonthlyRow(year, monthIndex, memberCode, monthly01, utilization) {
  const quarter = quarterFromMonth(monthIndex + 1);
  return {
    연도: year,
    월: monthIndex + 1,
    분기: quarter,
    구성원: memberCode,
    업무MM: monthly01.work,
    생산향상MM: monthly01.improve,
    휴일MM: monthly01.leave,
    가용MM: monthly01.available,
    '가동률%': utilization,
    상태: monthly01.status,
    제출일: monthly01.submittedAt ? String(monthly01.submittedAt).slice(0, 10) : '',
    승인일: monthly01.approvedAt ? String(monthly01.approvedAt).slice(0, 10) : '',
    승인자: monthly01.approver || '',
  };
}

export function computeTeamKpi({
  year,
  monthIndex,
  days,
  kpiWeekMemos = {},
  improveProjects = [],
  memberCode = JOURNAL_LINKED_MEMBER_CODE,
  kpi2RowStatus = {},
  monthly01 = null,
}) {
  const rows01c = buildKpi01cRows(year, monthIndex, days, kpiWeekMemos, memberCode);
  const rows02Effect = buildKpi02EffectRows(year, monthIndex, days, improveProjects, memberCode, kpi2RowStatus);
  const kpi1Derived = computeMonthKpi1Totals(year, monthIndex, days);

  let kpi1 = { ...kpi1Derived };
  if (monthly01 && !isMonthly01ContentUnset(monthly01)) {
    kpi1 = {
      work: monthly01.work != null ? Number(monthly01.work) : kpi1Derived.work,
      improve: monthly01.improve != null ? Number(monthly01.improve) : kpi1Derived.improve,
      leave: monthly01.leave != null ? Number(monthly01.leave) : kpi1Derived.leave,
      available: monthly01.available != null ? Number(monthly01.available) : kpi1Derived.available,
      total: 0,
      utilization: null,
    };
    kpi1.total = round4(kpi1.work + kpi1.improve + kpi1.leave);
  }
  if (kpi1.available > 0) {
    kpi1.utilization = round4((kpi1.total / kpi1.available) * 100);
  }
  const kpi2 = computeMonthKpi2Summary(rows02Effect, true);
  const kpi2Preview = computeMonthKpi2Summary(rows02Effect, false);

  const month01cTotals = rows01c.reduce(
    (acc, row) => ({
      work: round4(acc.work + row.업무MM),
      improve: round4(acc.improve + row.생산향상MM),
      leave: round4(acc.leave + row.휴일MM),
    }),
    { work: 0, improve: 0, leave: 0 }
  );

  return {
    rows01c,
    rows02Effect,
    kpi1,
    kpi2,
    month01cTotals,
    member: findKpiMember(memberCode) || { code: memberCode, displayName: memberCode },
    kpi2Preview,
  };
}

export function countKpi2EffectTasks(days, year, monthIndex) {
  const prefix = `${year}-${pad(monthIndex + 1)}`;
  let count = 0;
  Object.entries(days).forEach(([key, day]) => {
    if (!key.startsWith(prefix)) return;
    (day.tasks || []).forEach((task) => {
      if (isKpi2EffectTask(task) && task.done) count += 1;
    });
  });
  return count;
}

export function isImproveInvestmentTask(task) {
  if (LEAVE_MEMO_TASK_RE.test(task?.title)) return false;
  return getTaskMmAxis(task) === 'improve';
}
