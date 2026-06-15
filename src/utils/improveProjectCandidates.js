import { LEAVE_MEMO_TASK_RE } from './journalLeavePresets';
import { getTaskLoggedHours, getTaskMmAxis } from './journalMm';
import {
  improveProjectTitleKey,
  isImproveProjectTitleRegistered,
  normalizeImproveProjectTitle,
} from '../constants/improveProjects';

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * 월간 일지에서 생산성향상 M/M 업무 → 향상 과제 등록 후보
 * @param {{ year: number, monthIndex: number, getMemberDays: (code: string) => object, memberCodes?: string[], improveProjects?: object[] }} opts
 */
export function collectImproveMmCandidates({
  year,
  monthIndex,
  getMemberDays,
  memberCodes = [],
  improveProjects = [],
  /** UI 전용 — true면 alreadyRegistered 후보도 포함 (집계 조건은 동일) */
  includeRegistered = false,
}) {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const byKey = new Map();

  memberCodes.forEach((memberCode) => {
    const days = getMemberDays(memberCode) || {};
    Object.entries(days).forEach(([dayKey, day]) => {
      if (!dayKey.startsWith(prefix)) return;
      (day.tasks || []).forEach((task) => {
        if (!task) return;
        if (LEAVE_MEMO_TASK_RE.test(task.title || '')) return;
        if (getTaskMmAxis(task) !== 'improve') return;

        const title = normalizeImproveProjectTitle(task.title);
        if (!title) return;

        const key = improveProjectTitleKey(title);
        let entry = byKey.get(key);
        if (!entry) {
          entry = {
            title,
            normalizedKey: key,
            occurrenceCount: 0,
            totalActual: 0,
            withActualCount: 0,
            sources: [],
            alreadyRegistered: isImproveProjectTitleRegistered(title, improveProjects),
          };
          byKey.set(key, entry);
        }

        const actual = getTaskLoggedHours(task);
        entry.occurrenceCount += 1;
        entry.totalActual = round4(entry.totalActual + actual);
        if (actual > 0) entry.withActualCount += 1;
        entry.sources.push({ memberCode, dayKey, actual });
      });
    });
  });

  return [...byKey.values()]
    .filter((c) => includeRegistered || !c.alreadyRegistered)
    .sort((a, b) => {
      if (b.withActualCount !== a.withActualCount) return b.withActualCount - a.withActualCount;
      if (b.totalActual !== a.totalActual) return b.totalActual - a.totalActual;
      return a.title.localeCompare(b.title, 'ko');
    });
}

/** 후보 출처 요약 — 구성원별 건수·실작업 합 */
export function formatImproveCandidateSources(sources, formatMemberCode = (code) => code) {
  const byMember = new Map();
  sources.forEach(({ memberCode, actual }) => {
    const prev = byMember.get(memberCode) || { count: 0, actual: 0 };
    byMember.set(memberCode, {
      count: prev.count + 1,
      actual: round4(prev.actual + (Number(actual) || 0)),
    });
  });

  return [...byMember.entries()]
    .map(([code, { count, actual }]) => {
      const label = formatMemberCode(code);
      const hours = actual > 0 ? ` · ${actual}h` : '';
      return `${label} ${count}건${hours}`;
    })
    .join(' · ');
}
