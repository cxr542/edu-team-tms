import { LEAVE_MEMO_TASK_RE } from './journalLeavePresets.js';

export const LUNCH_HOURS = 1.5;
export const WORK_DAY_HOURS = 8;
export const LUNCH_LEAVE_MM = Math.round((LUNCH_HOURS / WORK_DAY_HOURS) * 10000) / 10000;
export const STANDARD_DAY_AVAILABLE_MM = 1;
export const FULL_LEAVE_MM = STANDARD_DAY_AVAILABLE_MM;
export const HALF_LEAVE_MM = roundMm(STANDARD_DAY_AVAILABLE_MM * 0.5);
export const QUARTER_LEAVE_MM = roundMm(STANDARD_DAY_AVAILABLE_MM * 0.25);
const LEGACY_LEAVE_MM_TOLERANCE = 0.0002;
const LEGACY_LEAVE_MM_VALUES = [
  [0.8125, FULL_LEAVE_MM],
  [0.4063, HALF_LEAVE_MM],
  [0.2031, QUARTER_LEAVE_MM],
];

export function roundMm(v) {
  return Math.round(v * 10000) / 10000;
}

export function hoursToMm(hours) {
  return roundMm((Number(hours) || 0) / WORK_DAY_HOURS);
}

export function normalizeJournalLeaveMm(value) {
  const leave = roundMm(Number(value) || 0);
  const legacy = LEGACY_LEAVE_MM_VALUES.find(([from]) => {
    return Math.abs(leave - from) <= LEGACY_LEAVE_MM_TOLERANCE;
  });
  return legacy ? legacy[1] : leave;
}

/** M/M·실작업 집계 대상 — 완료 체크 + 휴일 메모 제외 */
export function isTaskMmLogged(task) {
  if (LEAVE_MEMO_TASK_RE.test(task?.title || '')) return false;
  return Boolean(task?.done);
}

/** 완료된 업무의 실작업(h)만 M/M·KPI1·일일 합계에 반영 */
export function getTaskLoggedHours(task) {
  if (!isTaskMmLogged(task)) return 0;
  return Number(task?.actual) || 0;
}

export function getTaskMmAxis(task) {
  if (task.mmAxis === 'work' || task.mmAxis === 'improve') return task.mmAxis;
  return task.cat === 'ai' ? 'improve' : 'work';
}

/** 편집 패널 select — 미지정 시 AI→향상, 그 외→업무 */
export function getMmAxisSelectValue(task) {
  if (task?.mmAxis === 'work' || task?.mmAxis === 'improve') return task.mmAxis;
  return task?.cat === 'ai' ? 'improve' : 'work';
}

export function sumDayWorkHours(data) {
  return data.tasks.reduce((sum, t) => sum + getTaskLoggedHours(t), 0);
}

export function sumDayPlanHours(data) {
  return data.tasks.reduce((sum, t) => {
    if (LEAVE_MEMO_TASK_RE.test(t.title)) return sum;
    return sum + (Number(t.plan) || 0);
  }, 0);
}

export function getExpectedWorkHours(data) {
  const leave = normalizeJournalLeaveMm(data.mm.leave);
  if (data.holiday && leave >= FULL_LEAVE_MM - 0.001) return 0;
  if (leave >= HALF_LEAVE_MM - 0.001) {
    return WORK_DAY_HOURS * 0.5;
  }
  if (leave >= QUARTER_LEAVE_MM - 0.001) {
    return WORK_DAY_HOURS * 0.25;
  }
  return WORK_DAY_HOURS;
}

export function getDayHoursInfo(data) {
  const expected = getExpectedWorkHours(data);
  if (expected === 0) return { show: false };
  const total = sumDayWorkHours(data);
  const planned = sumDayPlanHours(data);
  return {
    show: true,
    total,
    planned,
    expected,
    isShort: total + 0.001 < expected,
  };
}

export function getDayAvailableMm(data) {
  return STANDARD_DAY_AVAILABLE_MM;
}

export function sumDayMm(data) {
  const m = data.mm;
  return Math.min(1, (Number(m.work) || 0) + (Number(m.improve) || 0) + (Number(m.leave) || 0));
}

export function sumCompletedDayMm(data) {
  const leave = normalizeJournalLeaveMm(data.mm.leave);
  return roundMm(hoursToMm(sumDayWorkHours(data)) + leave);
}

export function recalcDayMmFromHours(data) {
  const leave = normalizeJournalLeaveMm(data.mm.leave);
  if (data.holiday && leave >= FULL_LEAVE_MM - 0.001) {
    data.mm = { work: 0, improve: 0, leave: FULL_LEAVE_MM };
    return;
  }
  data.mm.leave = leave;
  let workH = 0;
  let improveH = 0;
  data.tasks.forEach((t) => {
    const h = getTaskLoggedHours(t);
    if (h <= 0) return;
    if (getTaskMmAxis(t) === 'improve') improveH += h;
    else workH += h;
  });
  let work = hoursToMm(workH);
  let improve = hoursToMm(improveH);
  const cap = Math.max(0, roundMm(1 - leave));
  const sum = work + improve;
  if (sum > cap && sum > 0) {
    const scale = cap / sum;
    work = roundMm(work * scale);
    improve = roundMm(improve * scale);
  }
  data.mm.work = work;
  data.mm.improve = improve;
}

export function getWeekCompletionStats(weekDays, month, getDayData) {
  const inMonthDays = weekDays.filter((d) => d.getMonth() === month);
  const count = inMonthDays.length;
  if (count === 0) return { available: 0, logged: 0, shortage: 0, pct: 100 };
  let availableSum = 0;
  let loggedSum = 0;
  inMonthDays.forEach((d) => {
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const data = getDayData(key);
    availableSum += getDayAvailableMm(data);
    loggedSum += sumCompletedDayMm(data);
  });
  const available = availableSum;
  const logged = loggedSum;
  const shortage = Math.max(0, available - logged);
  const pct = available > 0 ? Math.min(100, (logged / available) * 100) : 100;
  return { available, logged, shortage, pct, count };
}

export function getWeekMmStats(weekDays, month, getDayData) {
  return getWeekCompletionStats(weekDays, month, getDayData);
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function dateKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function getWeeksInMonth(year, month) {
  const weeks = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  let d = new Date(first);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  let w = 0;
  while (d <= last || weeks.length === 0) {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const copy = new Date(d);
      copy.setDate(d.getDate() + i);
      days.push(copy);
    }
    const inMonth = days.some((x) => x.getMonth() === month);
    if (inMonth) weeks.push({ index: ++w, days, key: `w${w}` });
    d.setDate(d.getDate() + 7);
    if (weeks.length >= 6) break;
    if (d > last && weeks.length > 0) break;
  }
  return weeks;
}
