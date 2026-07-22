import {
  migrateLegacyKpi2RowStatus,
  normalizeKpiOperationalStore,
} from '../constants/kpiOperationalStore.js';
import { JOURNAL_STORAGE_KEY } from './journalSnapshot.js';
import { hasKpi2EffectEnabled } from './computeTeamKpi.js';

/** localStorage 저널에서 memberJournals 로드 (badge·마이그레이션용) */
export function loadMemberJournalsFromStorage() {
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.memberJournals && typeof parsed.memberJournals === 'object') {
      return parsed.memberJournals;
    }
    if (parsed?.days) {
      return { A: { days: parsed.days } };
    }
  } catch {
    /* ignore */
  }
  return {};
}

/** legacy KPI2 row → 단일 memberCode (중복·미매칭 시 null) */
export function resolveLegacyKpi2Member(memberJournals, dayKey, taskId) {
  if (!memberJournals || typeof memberJournals !== 'object') return null;
  const matched = [];
  Object.entries(memberJournals).forEach(([memberCode, slice]) => {
    const day = slice?.days?.[dayKey];
    if (!day) return;
    const found = (day.tasks || []).some(
      (task) => task?.id === taskId && hasKpi2EffectEnabled(task)
    );
    if (found) matched.push(memberCode);
  });
  return matched.length === 1 ? matched[0] : null;
}

/** 읽기 전용 legacy KPI2 row migration — localStorage KPI store는 변경하지 않음 */
export function migrateKpiOperationalStoreReadonly(
  store,
  memberJournals = loadMemberJournalsFromStorage()
) {
  const normalized = normalizeKpiOperationalStore(store);
  return migrateLegacyKpi2RowStatus(normalized, (dayKey, taskId) =>
    resolveLegacyKpi2Member(memberJournals, dayKey, taskId)
  );
}
