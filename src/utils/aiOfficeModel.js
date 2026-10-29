import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers.js';
import {
  buildKpi02EffectRows,
  computeMonthKpi1Totals,
  computeMonthKpi2Summary,
} from './computeTeamKpi.js';
import { LEAVE_MEMO_TASK_RE } from './journalLeavePresets.js';

/** 이 비율 미만이면 '막힘' (오늘까지 잡힌 업무 기준) */
export const BLOCKED_RATE = 0.7;

export const ADMIN_AGENT_ID = 'admin';

/** 캐릭터는 모두 햄스터. 관리자(/admin 권한)만 이장님, 나머지는 주민으로 보인다. */
export const CHARACTER_KIND = { [ADMIN_AGENT_ID]: 'mayor' };
export const DEFAULT_KIND = 'villager';
export const KIND_TITLE = { mayor: '이장님', villager: '주민' };

const pad = (n) => String(n).padStart(2, '0');

/** 반차·연차 같은 휴일 M/M 메모는 업무 건수에서 뺀다 (KPI 집계와 같은 기준) */
const isWorkTask = (task) => !LEAVE_MEMO_TASK_RE.test(task?.title || '');
const workTasksOf = (entry) => (Array.isArray(entry?.tasks) ? entry.tasks.filter(isWorkTask) : []);

/** 로컬 날짜 → 'YYYY-MM-DD' */
export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' → 그 주 월요일 'YYYY-MM-DD' */
export function mondayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

/**
 * 구성원 한 명의 일지를 집계. 오늘 이후 날짜의 계획은 완료율에서 뺀다.
 * @returns {{ total: number, done: number, hours: number, todayTasks: number }}
 */
export function summarizeMemberJournal(journal, today) {
  let total = 0;
  let done = 0;
  let hours = 0;
  let todayTasks = 0;
  for (const [day, entry] of Object.entries(journal?.days || {})) {
    const tasks = workTasksOf(entry);
    if (day === today) todayTasks += tasks.length;
    if (day > today) continue;
    for (const task of tasks) {
      total += 1;
      hours += Number(task?.actual) || 0;
      if (task?.done) done += 1;
    }
  }
  return { total, done, hours, todayTasks };
}

/** 일지가 없으면 대기, 완료율 낮으면 막힘, 오늘 일지가 있으면 작업중, 남은 일이 있으면 생각중 */
export function deriveMemberStatus({ total, done, todayTasks }) {
  if (total === 0 && todayTasks === 0) return '대기';
  const rate = total ? done / total : 1;
  if (rate < BLOCKED_RATE) return '막힘';
  if (todayTasks > 0) return '작업중';
  return done < total ? '생각중' : '대기';
}

function describeMember(stats, status) {
  if (status === '대기' && stats.total === 0) return '일지 기록 없음';
  const open = stats.total - stats.done;
  if (status === '작업중') return `오늘 업무 ${stats.todayTasks}건 기록 · 미완료 ${open}건`;
  if (status === '막힘') return `미완료 업무 ${open}건 · 완료율 ${Math.round((stats.done / (stats.total || 1)) * 100)}%`;
  if (status === '생각중') return `오늘 일지 전 · 미완료 업무 ${open}건`;
  return '남은 업무 없음';
}

/**
 * 캐릭터 목록: 구성원(A/B/C) + 관리자(/admin 권한, KPI 승인 대기 기준).
 * @param {Record<string, any>} memberJournals JournalProvider 의 memberJournals
 * @param {{ today?: string, adminPending?: number | null }} [options]
 */
export function buildAiOfficeAgents(memberJournals, { today = toDateKey(), adminPending = null } = {}) {
  const members = TEAM_KPI_MEMBERS.map((member) => {
    const stats = summarizeMemberJournal(memberJournals?.[member.code], today);
    const status = deriveMemberStatus(stats);
    return {
      id: member.code,
      name: member.displayName,
      role: member.role,
      kind: CHARACTER_KIND[member.code] || DEFAULT_KIND,
      room: '교육팀',
      status,
      task: describeMember(stats, status),
      done: stats.done,
      total: stats.total,
      hours: stats.hours,
      rate: stats.total ? stats.done / stats.total : 0,
    };
  });
  const pending = Number(adminPending) || 0;
  const admin = {
    id: ADMIN_AGENT_ID,
    name: '관리자',
    role: '관리자',
    kind: CHARACTER_KIND[ADMIN_AGENT_ID],
    room: '관리실',
    status: pending > 0 ? '작업중' : '대기',
    task: pending > 0 ? `KPI 승인 대기 ${pending}건` : adminPending == null ? '관리자 모드에서 승인 대기를 확인해요' : 'KPI 승인 대기 없음',
    done: 0,
    total: 0,
    hours: 0,
    rate: 0,
  };
  return [admin, ...members];
}

/** 막힌 구성원마다 대기·생각중 구성원 중 완료율이 높은 사람을 도우미로 짝짓는다. */
export function pickRescues(agents) {
  const helpers = [
    ...agents.filter((a) => a.status === '대기' && a.role !== '관리자').sort((x, y) => y.rate - x.rate),
    ...agents.filter((a) => a.status === '생각중').sort((x, y) => y.rate - x.rate),
  ];
  return agents
    .filter((a) => a.status === '막힘')
    .map((blocked, i) => ({ blocked, helper: helpers[i] || null }));
}

/** 팀 전체 지표 */
export function summarizeOffice(agents) {
  const members = agents.filter((a) => a.role !== '관리자');
  const done = agents.reduce((s, a) => s + a.done, 0);
  const total = agents.reduce((s, a) => s + a.total, 0);
  return {
    headcount: agents.length,
    working: agents.filter((a) => a.status === '작업중').length,
    blocked: agents.filter((a) => a.status === '막힘').length,
    done,
    rate: total ? done / total : 0,
    hours: agents.reduce((s, a) => s + a.hours, 0),
    activeShare: members.length ? members.filter((a) => a.status !== '대기').length / members.length : 0,
  };
}

/** 월요일 기준 주별 완료 업무 수 (오늘까지, 최근 `weeks`주) */
export function buildWeeklyDone(memberJournals, today = toDateKey(), weeks = 8) {
  const byWeek = new Map();
  for (const journal of Object.values(memberJournals || {})) {
    for (const [day, entry] of Object.entries(journal?.days || {})) {
      if (day > today) continue;
      const count = workTasksOf(entry).filter((t) => t?.done).length;
      if (!count) continue;
      const week = mondayOf(day);
      byWeek.set(week, (byWeek.get(week) || 0) + count);
    }
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-weeks)
    .map(([week, tasks]) => ({ week, tasks }));
}

/**
 * 월별 업무 진행: 완료 / 미완료(오늘까지) / 예정(오늘 이후, 아직 안 끝난 계획).
 * @returns {{ month: number, done: number, open: number, planned: number, total: number, rate: number }[]} 1~12월
 */
export function buildMonthlyProgress(memberJournals, year, today = toDateKey()) {
  const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, done: 0, open: 0, planned: 0 }));
  for (const journal of Object.values(memberJournals || {})) {
    for (const [day, entry] of Object.entries(journal?.days || {})) {
      if (!day.startsWith(`${year}-`)) continue;
      const bucket = months[Number(day.slice(5, 7)) - 1];
      if (!bucket) continue;
      for (const task of workTasksOf(entry)) {
        if (task?.done) bucket.done += 1;
        else if (day <= today) bucket.open += 1;
        else bucket.planned += 1;
      }
    }
  }
  return months.map((m) => {
    const total = m.done + m.open + m.planned;
    const settled = m.done + m.open;
    return { ...m, total, rate: settled ? m.done / settled : 0 };
  });
}

/**
 * 월 단위 가동률·생산성. 앱의 KPI 정의를 그대로 쓴다.
 * - 가동률 = (업무+생산향상+휴일 M/M) ÷ 가용 M/M  (KPI1, computeMonthKpi1Totals)
 * - 생산성 = 계획시간 ÷ 실작업시간 (KPI2 효과 건, 승인 전 건 포함한 미리보기)
 * 그 달 일지 기록이 없는 구성원은 값을 비워 두고 팀 합계에서도 뺀다.
 */
export function buildMonthlyMetrics(memberJournals, year, monthIndex) {
  const prefix = `${year}-${pad(monthIndex + 1)}`;
  const members = TEAM_KPI_MEMBERS.map((member) => {
    const days = memberJournals?.[member.code]?.days || {};
    const hasEntries = Object.entries(days).some(
      ([key, entry]) => key.startsWith(prefix) && (workTasksOf(entry).length > 0 || Number(entry?.mm?.work) > 0),
    );
    const kpi1 = computeMonthKpi1Totals(year, monthIndex, days);
    const effectRows = buildKpi02EffectRows(year, monthIndex, days, [], member.code);
    const kpi2 = computeMonthKpi2Summary(effectRows, false);
    return {
      code: member.code,
      name: member.displayName,
      hasEntries,
      work: kpi1.work,
      improve: kpi1.improve,
      leave: kpi1.leave,
      available: kpi1.available,
      total: kpi1.total,
      utilization: hasEntries ? kpi1.utilization : null,
      productivity: kpi2.productivityPct,
      effectCount: kpi2.submittedCount,
      effectRows,
    };
  });
  const active = members.filter((m) => m.hasEntries);
  const total = active.reduce((s, m) => s + m.total, 0);
  const available = active.reduce((s, m) => s + m.available, 0);
  const kpi2 = computeMonthKpi2Summary(active.flatMap((m) => m.effectRows), false);
  return {
    members,
    team: {
      activeCount: active.length,
      utilization: available > 0 ? Math.round((total / available) * 10000) / 100 : null,
      productivity: kpi2.productivityPct,
      effectCount: kpi2.submittedCount,
    },
  };
}

/** 구성원별 업무 건수: 완료 / 미완료(오늘까지) / 예정(오늘 이후) */
export function buildMemberTaskCounts(memberJournals, today = toDateKey()) {
  return TEAM_KPI_MEMBERS.map((member) => {
    let done = 0;
    let open = 0;
    let planned = 0;
    for (const [day, entry] of Object.entries(memberJournals?.[member.code]?.days || {})) {
      for (const task of workTasksOf(entry)) {
        if (task?.done) done += 1;
        else if (day <= today) open += 1;
        else planned += 1;
      }
    }
    const settled = done + open;
    return { code: member.code, name: member.displayName, done, open, planned, rate: settled ? done / settled : 0 };
  });
}

/**
 * 오늘까지의 미완료 업무 목록(최근 날짜 순). memberCode 를 주면 그 구성원만.
 * @returns {{ items: { code: string, name: string, day: string, title: string, cat: string, plan: number }[], total: number }}
 */
export function listOpenTasks(memberJournals, { today = toDateKey(), memberCode = null, limit = 30 } = {}) {
  const items = [];
  for (const member of TEAM_KPI_MEMBERS) {
    if (memberCode && member.code !== memberCode) continue;
    for (const [day, entry] of Object.entries(memberJournals?.[member.code]?.days || {})) {
      if (day > today) continue;
      for (const task of workTasksOf(entry)) {
        if (task?.done) continue;
        items.push({
          code: member.code,
          name: member.displayName,
          day,
          title: String(task?.title || '(제목 없음)'),
          cat: String(task?.cat || ''),
          plan: Number(task?.plan) || 0,
        });
      }
    }
  }
  items.sort((a, b) => (a.day === b.day ? a.name.localeCompare(b.name) : a.day < b.day ? 1 : -1));
  return { items: items.slice(0, limit), total: items.length };
}

/** 시간대: 낮 6~17시, 저녁 17~20시, 그 밖은 밤. 사무실 창밖 하늘과 조명 색이 바뀐다. */
export function timeOfDay(date) {
  const h = date.getHours();
  if (h >= 6 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}
