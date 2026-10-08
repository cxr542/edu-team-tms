/**
 * KPI3 분기 4요소(다면·리더·실전) 제출 공유 스냅샷 — 순수 병합 로직.
 * 저장 형태: quarters[yq][memberCode] = { dmDetail, leaderDetail, practiceDetail, quarter, appeals, execApproval, updatedAt }
 * 팀장 메모(memos)는 공유하지 않는다.
 *
 * 필드 소유권
 *  - 구성원: dmDetail/leaderDetail/practiceDetail 의 입력값과 제출(submitted/취소)
 *  - 팀장: 검토 상태(approved/rejected), leaderDetail.managerScore, quarter 점수·확정, appeals, execApproval
 */

import { defaultQuarterRecord } from '../constants/kpiOperationalStore.js';

export const KPI_QUARTER_CLOUD_SNAPSHOT_VERSION = 1;

const YQ_RE = /^\d{4}-[1-4]Q$/;
export const QUARTER_DETAIL_KEYS = ['dmDetail', 'leaderDetail', 'practiceDetail'];
/** 검토(제출) 상태 필드 — 팀장이 approved/rejected 로 바꾼다 */
const REVIEW_FIELDS = [
  'submissionStatus',
  'submittedAt',
  'submittedBy',
  'reviewedAt',
  'reviewedBy',
  'rejectedReason',
];
const MANAGER_ONLY_DETAIL_FIELDS = { leaderDetail: ['managerScore'] };
const MEMBER_CODES = ['A', 'B', 'C'];

export function isValidQuarterKey(yq) {
  return YQ_RE.test(String(yq || ''));
}

export function isValidQuarterMemberCode(code) {
  return MEMBER_CODES.includes(code);
}

function nowIso() {
  return new Date().toISOString();
}

function ts(value) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function statusOf(detail) {
  return detail?.submissionStatus || (detail?.submittedAt ? 'submitted' : '');
}

/** 로컬 분기 레코드 → 공유 슬라이스 (memos 제외) */
export function pickSharedQuarterRecord(rec) {
  if (!rec || typeof rec !== 'object') return null;
  return {
    dmDetail: clone(rec.dmDetail) ?? {},
    leaderDetail: clone(rec.leaderDetail) ?? {},
    practiceDetail: clone(rec.practiceDetail) ?? { cases: [] },
    quarter: clone(rec.quarter) ?? {},
    appeals: clone(rec.appeals) ?? [],
    execApproval: clone(rec.execApproval) ?? null,
    updatedAt: typeof rec.updatedAt === 'string' ? rec.updatedAt : null,
  };
}

/** 공유 저장 가치가 있는 레코드인지 — 제출·입력·확정 흔적이 하나도 없으면 false */
export function isQuarterRecordSaveable(rec) {
  if (!rec || typeof rec !== 'object') return false;
  if (QUARTER_DETAIL_KEYS.some((key) => statusOf(rec[key]))) return true;
  if (rec.quarter?.locked) return true;
  const leader = rec.leaderDetail || {};
  if (String(leader.memberSelf ?? '') !== '' || String(leader.managerScore ?? '') !== '') return true;
  if ((rec.practiceDetail?.cases || []).length > 0) return true;
  const dm = rec.dmDetail || {};
  return ['lectureAvg', 'lectureN', 'opsAvg', 'opsN'].some(
    (k) => dm[k] !== undefined && dm[k] !== '' && dm[k] !== null && Number(dm[k]) !== 0
  );
}

export function createEmptyQuarterCloudSnapshot() {
  const at = nowIso();
  return {
    version: KPI_QUARTER_CLOUD_SNAPSHOT_VERSION,
    publishedAt: at,
    meta: { updatedAt: at },
    quarters: {},
  };
}

export function normalizeQuarterCloudSnapshot(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const nested = source.kpiOperational && typeof source.kpiOperational === 'object'
    ? source.kpiOperational.quarters
    : undefined;
  const treeRaw = source.quarters ?? nested ?? {};
  const quarters = {};
  Object.entries(treeRaw && typeof treeRaw === 'object' ? treeRaw : {}).forEach(([yq, members]) => {
    if (!isValidQuarterKey(yq) || !members || typeof members !== 'object') return;
    const out = {};
    Object.entries(members).forEach(([code, rec]) => {
      if (!isValidQuarterMemberCode(code)) return;
      const picked = pickSharedQuarterRecord(rec);
      if (picked) out[code] = picked;
    });
    if (Object.keys(out).length > 0) quarters[yq] = out;
  });
  const publishedAt = typeof source.publishedAt === 'string' ? source.publishedAt : nowIso();
  const metaIn = source.meta && typeof source.meta === 'object' ? source.meta : {};
  return {
    version: KPI_QUARTER_CLOUD_SNAPSHOT_VERSION,
    publishedAt,
    meta: { ...metaIn, updatedAt: typeof metaIn.updatedAt === 'string' ? metaIn.updatedAt : publishedAt },
    quarters,
  };
}

export function formatQuarterCloudApiPayload(snapshot) {
  const n = normalizeQuarterCloudSnapshot(snapshot);
  return {
    version: n.version,
    publishedAt: n.publishedAt,
    meta: n.meta,
    kpiOperational: { quarters: n.quarters },
  };
}

function withoutKeys(obj, keys) {
  const out = { ...(obj || {}) };
  keys.forEach((k) => delete out[k]);
  return out;
}

/**
 * 구성원 입력을 반영한 섹션 — 팀장 소유 필드(managerScore)와 승인/반려 상태는 existing 유지.
 * 반환 null = 반영하지 않음(승인됨·확정·오래된 입력).
 */
function applyMemberSection(key, existing, incoming, quarterLocked) {
  const cur = existing || {};
  const inc = incoming || {};
  const curStatus = statusOf(cur);
  if (quarterLocked) return null;
  if (curStatus === 'approved') return null;
  // 팀장이 반려한 뒤 구성원이 다시 제출하지 않은 오래된 입력은 무시
  const incStatus = statusOf(inc);
  if (curStatus === 'rejected' && ts(cur.reviewedAt) > ts(inc.submittedAt)) return null;
  if (incStatus === 'approved' || incStatus === 'rejected') return null;

  const managerFields = MANAGER_ONLY_DETAIL_FIELDS[key] || [];
  const next = { ...withoutKeys(inc, managerFields), ...Object.fromEntries(managerFields.filter((f) => f in cur).map((f) => [f, cur[f]])) };
  // 제출 취소('')·제출 모두 구성원 소유. 검토 필드는 incoming 값 그대로.
  REVIEW_FIELDS.forEach((f) => {
    next[f] = inc[f] ?? '';
  });
  return next;
}

/**
 * 공유본 한 건에 push 병합 (서버/클라이언트 공용)
 * @param {object|null} existing 공유본의 기존 레코드
 * @param {object} incoming 작성자의 로컬 레코드
 * @param {'member'|'manager'} role
 * @returns {{ record: object, applied: string[], skipped: string[] }}
 */
export function mergeQuarterPush(existing, incoming, role, { updatedAt = nowIso() } = {}) {
  const base =
    pickSharedQuarterRecord(existing) ||
    pickSharedQuarterRecord({ quarter: defaultQuarterRecord('A').quarter });
  const inc = pickSharedQuarterRecord(incoming) || pickSharedQuarterRecord({});
  const applied = [];
  const skipped = [];
  const record = { ...base };

  if (role === 'manager') {
    QUARTER_DETAIL_KEYS.forEach((key) => {
      // 팀장은 검토 상태·managerScore 를 쓰고, 구성원 입력은 공유본 최신(구성원 제출분)을 보존한다
      const cur = base[key] || {};
      const mine = inc[key] || {};
      const managerFields = MANAGER_ONLY_DETAIL_FIELDS[key] || [];
      const memberInputs = withoutKeys(cur, [...REVIEW_FIELDS, ...managerFields]);
      const mergedReview = {};
      const memberResubmittedAfterReview = ts(cur.submittedAt) > ts(mine.reviewedAt) && ts(cur.submittedAt) > ts(mine.submittedAt);
      REVIEW_FIELDS.forEach((f) => {
        mergedReview[f] = (memberResubmittedAfterReview ? cur[f] : mine[f]) ?? '';
      });
      const mgrOwned = Object.fromEntries(managerFields.map((f) => [f, mine[f] ?? cur[f] ?? '']));
      // 공유본에 구성원 입력이 아직 없으면(처음 올리는 팀장 로컬 복사본) 팀장 로컬을 그대로 사용
      const hasMemberSide = Object.keys(memberInputs).length > 0 || statusOf(cur);
      record[key] = hasMemberSide
        ? { ...memberInputs, ...mergedReview, ...mgrOwned }
        : clone(mine);
      applied.push(key);
    });
    record.quarter = clone(inc.quarter);
    record.appeals = clone(inc.appeals);
    record.execApproval = clone(inc.execApproval);
    applied.push('quarter', 'appeals', 'execApproval');
  } else {
    const locked = Boolean(base.quarter?.locked);
    QUARTER_DETAIL_KEYS.forEach((key) => {
      const next = applyMemberSection(key, base[key], inc[key], locked);
      if (next === null) {
        skipped.push(key);
      } else {
        record[key] = next;
        applied.push(key);
      }
    });
  }

  record.updatedAt = updatedAt;
  return { record, applied, skipped };
}

/** snapshot 에 단일 member·yq upsert */
export function mergeMemberIntoQuarterCloudSnapshot(
  snapshot,
  memberCode,
  yearQuarter,
  incoming,
  role,
  { updatedAt = nowIso() } = {}
) {
  if (!isValidQuarterMemberCode(memberCode)) {
    throw new Error('memberCode는 A/B/C 중 하나여야 합니다.');
  }
  if (!isValidQuarterKey(yearQuarter)) {
    throw new Error('yearQuarter는 YYYY-NQ 형식이어야 합니다.');
  }
  const current = normalizeQuarterCloudSnapshot(snapshot);
  const existing = current.quarters[yearQuarter]?.[memberCode] || null;
  const { record, applied, skipped } = mergeQuarterPush(existing, incoming, role, { updatedAt });
  if (!existing && !isQuarterRecordSaveable(record)) {
    const err = new Error('저장할 분기 평가 내용이 없습니다.');
    err.code = 'EMPTY_RECORD';
    throw err;
  }
  const quarters = {
    ...current.quarters,
    [yearQuarter]: { ...(current.quarters[yearQuarter] || {}), [memberCode]: record },
  };
  return {
    snapshot: normalizeQuarterCloudSnapshot({
      publishedAt: updatedAt,
      meta: { ...current.meta, updatedAt },
      quarters,
    }),
    applied,
    skipped,
  };
}

/**
 * pull 병합 — 공유본을 로컬 분기 레코드에 반영
 *  - manager: 구성원 입력·제출은 공유본, 팀장 소유(managerScore·quarter·appeals·execApproval)는 로컬 유지
 *  - member: 팀장 소유는 공유본, 입력·제출은 로컬 유지 (공유본 상태가 더 새로우면 검토 결과 반영)
 * 로컬 memos 등 공유 대상이 아닌 필드는 건드리지 않는다.
 */
export function mergeQuarterRecordFromRemote(localRec, remoteRec, role) {
  const local = localRec || {};
  const remote = pickSharedQuarterRecord(remoteRec);
  if (!remote) return { record: local, changed: false };
  const out = { ...local };
  let changed = false;
  const set = (key, value) => {
    if (JSON.stringify(out[key]) !== JSON.stringify(value)) {
      out[key] = value;
      changed = true;
    }
  };

  QUARTER_DETAIL_KEYS.forEach((key) => {
    const l = local[key] || {};
    const r = remote[key] || {};
    const managerFields = MANAGER_ONLY_DETAIL_FIELDS[key] || [];
    if (role === 'manager') {
      const remoteIsNewer = ts(r.submittedAt) > Math.max(ts(l.submittedAt), ts(l.reviewedAt));
      const localEmptyOfSubmission = !statusOf(l);
      if (statusOf(r) && (remoteIsNewer || localEmptyOfSubmission)) {
        // 구성원 입력 + 제출 상태를 가져오되 팀장 소유 필드는 로컬 유지
        const next = { ...l, ...withoutKeys(r, managerFields) };
        managerFields.forEach((f) => {
          if (f in l) next[f] = l[f];
        });
        set(key, next);
      }
    } else {
      // 구성원: 공유본에 팀장 검토 결과가 있고 내 마지막 제출보다 새로우면 반영
      const reviewNewer = ts(r.reviewedAt) > ts(l.submittedAt) && ts(r.reviewedAt) > ts(l.reviewedAt);
      const next = { ...l };
      managerFields.forEach((f) => {
        if (r[f] !== undefined && r[f] !== '') next[f] = r[f];
      });
      if (reviewNewer) REVIEW_FIELDS.forEach((f) => { next[f] = r[f] ?? ''; });
      set(key, next);
    }
  });

  if (role === 'member') {
    const remoteQuarter = remote.quarter || {};
    if (remoteQuarter.locked || ts(remoteQuarter.confirmedAt) > ts(local.quarter?.confirmedAt)) {
      set('quarter', { ...(local.quarter || {}), ...remoteQuarter });
    }
    set('appeals', remote.appeals);
    set('execApproval', remote.execApproval);
  }
  return { record: out, changed };
}

/** KPI store 의 quarters 에 공유 스냅샷을 병합 (나머지 필드는 그대로) */
export function mergeQuartersIntoKpiStore(localStore, remoteSnapshot, role) {
  const local = localStore && typeof localStore === 'object' ? localStore : {};
  const remote = normalizeQuarterCloudSnapshot(remoteSnapshot);
  const quarters = { ...(local.quarters || {}) };
  let changedCount = 0;
  Object.entries(remote.quarters).forEach(([yq, members]) => {
    Object.entries(members).forEach(([code, remoteRec]) => {
      const localRec = quarters[yq]?.[code] || defaultQuarterRecord(code);
      const { record, changed } = mergeQuarterRecordFromRemote(localRec, remoteRec, role);
      if (changed) {
        quarters[yq] = { ...(quarters[yq] || {}), [code]: record };
        changedCount += 1;
      }
    });
  });
  return { store: { ...local, quarters }, changedCount };
}

/**
 * 구성원이 화면을 열었을 때 한 번 보충 저장(백필)이 필요한지
 * - 공유본에 내 분기 레코드가 없고 저장할 내용이 있거나
 * - 로컬 제출(submittedAt)이 공유본보다 새로운 섹션이 있을 때
 */
export function needsQuarterBackfillPush(localRec, remoteSnapshot, yq, memberCode) {
  if (!isQuarterRecordSaveable(localRec)) return false;
  const remote = normalizeQuarterCloudSnapshot(remoteSnapshot).quarters[yq]?.[memberCode];
  if (!remote) return true;
  return QUARTER_DETAIL_KEYS.some((key) => {
    const l = localRec[key] || {};
    if (!statusOf(l)) return false;
    return ts(l.submittedAt) > ts(remote[key]?.submittedAt);
  });
}
