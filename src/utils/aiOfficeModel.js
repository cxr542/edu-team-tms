import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers.js';

/** 이 비율 미만이면 '막힘' (오늘까지 잡힌 업무 기준) */
export const BLOCKED_RATE = 0.7;

export const ADMIN_AGENT_ID = 'admin';

const pad = (n) => String(n).padStart(2, '0');

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
    const tasks = Array.isArray(entry?.tasks) ? entry.tasks : [];
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
      if (day > today || !Array.isArray(entry?.tasks)) continue;
      const count = entry.tasks.filter((t) => t?.done).length;
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
