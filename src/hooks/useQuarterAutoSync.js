import { useEffect } from 'react';
import { needsQuarterBackfillPush } from '../utils/kpiQuarterCloudSnapshot';
import { listUnsharedManagerLocks, normalizeCompetencyCloudSnapshot } from '../utils/kpiOperationalCloudSnapshot';

/** 세션 내 (역할·구성원·분기) 단위로 1회만 — 성공 시에만 기록하고 실패하면 다음 진입에서 재시도 */
const autoSyncedQuarterKeys = new Set();

/** 테스트용 */
export function resetQuarterAutoSyncSession() {
  autoSyncedQuarterKeys.clear();
}

/**
 * 분기 4요소 공유 자동 동기화 (화면 진입 시 1회)
 *  - manager: 공유본 가져오기 (구성원 제출분만 갱신)
 *  - member: 공유본 확인 후 미공유 제출분 보충 저장
 * 탭과 무관하게 화면(페이지) 단위로 호출한다. 실패는 토스트로 알린다.
 */
export function runQuarterAutoSync({ journal, role, memberCode, year, monthIndex, yq, quarterRec, onToast }) {
  const key = `${role}:${memberCode}:${yq}`;
  if (autoSyncedQuarterKeys.has(key)) return Promise.resolve('skipped');
  autoSyncedQuarterKeys.add(key);
  return (async () => {
    const pulled = await journal.pullKpi3QuarterCloudSnapshot(role);
    if (!pulled?.ok) {
      autoSyncedQuarterKeys.delete(key);
      if (pulled?.reason === 'error') {
        onToast?.(`분기 평가 공유본을 확인하지 못했습니다 (${pulled.error?.message || '오류'})`);
      }
      return 'pull-failed';
    }
    if (role === 'manager') {
      if (pulled.changedCount > 0) {
        onToast?.(`구성원 분기 평가 공유본 ${pulled.changedCount}건을 자동으로 반영했습니다`);
      }
      return 'pulled';
    }
    if (!needsQuarterBackfillPush(quarterRec, pulled.remote, yq, memberCode)) return 'in-sync';
    const r = await journal.saveKpi3QuarterCloudSnapshot?.(memberCode, year, monthIndex);
    if (r?.ok) {
      onToast?.('제출한 분기 평가를 팀 공유 저장소에 자동 저장했습니다');
      return 'pushed';
    }
    if (r && r.reason !== 'dev-blocked' && r.reason !== 'read-only') {
      autoSyncedQuarterKeys.delete(key);
      onToast?.(`분기 평가 자동 저장에 실패했습니다 (${r.error?.message || r.reason}) — 「분기 공유 저장」으로 다시 시도하세요`);
    }
    return 'push-failed';
  })();
}

export function useQuarterAutoSync({ enabled, journal, role, memberCode, year, monthIndex, yq, quarterRec, onToast }) {
  useEffect(() => {
    if (!enabled || !journal?.pullKpi3QuarterCloudSnapshot) return;
    runQuarterAutoSync({ journal, role, memberCode, year, monthIndex, yq, quarterRec, onToast });
    // quarterRec/onToast 변경으로 재실행하지 않는다 (세션 1회)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, role, memberCode, yq]);
}

/** 월간 역량 평가 — 세션 내 (역할·분기) 단위 1회 */
const autoPulledCompetencyKeys = new Set();

export function resetCompetencyAutoPullSession() {
  autoPulledCompetencyKeys.clear();
}

/**
 * 월간 역량 평가 공유본을 화면 진입 시 한 번 자동으로 가져온다 (수동 「팀 공유본 가져오기」는 그대로).
 * 병합은 기존 규칙(잠금 우선·더 새로운 쪽 우선)이며 실패하면 알리고 다음 진입에서 재시도한다.
 */
export async function runCompetencyAutoPull({ journal, role, yq, onToast }) {
  const key = `${role}:${yq}`;
  if (autoPulledCompetencyKeys.has(key)) return 'skipped';
  autoPulledCompetencyKeys.add(key);
  const r = await journal.pullCompetencyCloudSnapshot();
  if (!r?.ok) {
    autoPulledCompetencyKeys.delete(key);
    if (r?.reason === 'error') {
      onToast?.(`월간 역량 평가 공유본을 확인하지 못했습니다 (${r.error?.message || '오류'})`);
    }
    return 'failed';
  }
  if (r.changed) onToast?.('월간 역량 평가 공유본을 자동으로 반영했습니다');

  // 팀장: 확정은 로컬에만 있고 공유본에 없는 월(과거 저장 누락분)을 한 번 보충 저장한다
  let pushed = 0;
  if (role === 'manager' && r.store && journal.saveCompetencyMemberCloudSnapshot) {
    const remoteMonths = normalizeCompetencyCloudSnapshot(r.remote).competencyMonths;
    const targets = listUnsharedManagerLocks(r.store.competencyMonths, remoteMonths);
    for (const t of targets) {
      const res = await journal.saveCompetencyMemberCloudSnapshot(t.memberCode, t.ym, t.record);
      if (res?.ok) pushed += 1;
      else if (res?.reason === 'dev-blocked' || res?.reason === 'read-only') break;
      else {
        onToast?.(`팀장 확정 ${t.ym} 공유 저장에 실패했습니다 (${res?.error?.message || res?.reason})`);
        break;
      }
    }
    if (pushed > 0) onToast?.(`공유되지 않았던 팀장 확정 ${pushed}건을 팀 공유 저장소에 저장했습니다`);
  }
  return pushed > 0 ? 'backfilled' : r.changed ? 'pulled' : 'in-sync';
}

export function useCompetencyAutoPull({ enabled, journal, role, yq, onToast }) {
  useEffect(() => {
    if (!enabled || !journal?.pullCompetencyCloudSnapshot) return;
    runCompetencyAutoPull({ journal, role, yq, onToast });
    // onToast 변경으로 재실행하지 않는다 (세션 1회)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, role, yq]);
}
