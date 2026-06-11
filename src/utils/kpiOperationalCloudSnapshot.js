import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers';
import {
  defaultCompetencyMonthRecord,
  normalizeKpiOperationalStore,
} from '../constants/kpiOperationalStore';
import { DIM_MET, DIM_UNMET, mapMemberRoleToCompetency } from '../constants/competencyRubric';
import {
  computeCompetencyEval,
  isValidCompetencyIntLevel,
  normalizeCompetencyIntLevel,
} from './competencyScore';

export const KPI_COMPETENCY_CLOUD_SNAPSHOT_VERSION = 1;

export const KPI_COMPETENCY_MEMBER_CODES = TEAM_KPI_MEMBERS.map((m) => m.code);

function nowIso() {
  return new Date().toISOString();
}

function isNewer(left, right) {
  if (!right) return false;
  if (!left) return true;
  return new Date(left).getTime() > new Date(right).getTime();
}

function resolveRoleId(record, memberCode) {
  if (record?.roleId) return record.roleId;
  const member = TEAM_KPI_MEMBERS.find((m) => m.code === memberCode);
  return mapMemberRoleToCompetency(member?.role);
}

function normalizeEvalSide(side, roleId) {
  const base = defaultCompetencyMonthRecord('A').self;
  const intLevel = normalizeCompetencyIntLevel(side?.intLevel ?? base.intLevel);
  const dims = { ...base.dims, ...(side?.dims || {}) };
  const evalInput = { intLevel, dims, roleId };
  return {
    intLevel,
    dims,
    computed: computeCompetencyEval(evalInput),
  };
}

function applyTimestampFallbacks(record) {
  const legacy = typeof record.updatedAt === 'string' ? record.updatedAt : null;
  const selfUpdatedAt =
    typeof record.selfUpdatedAt === 'string' ? record.selfUpdatedAt : legacy;
  const managerUpdatedAt =
    typeof record.managerUpdatedAt === 'string' ? record.managerUpdatedAt : legacy;
  return { selfUpdatedAt, managerUpdatedAt, legacyUpdatedAt: legacy };
}

/**
 * competencyMonths[ym][memberCode] 레코드 정규화
 * - selfUpdatedAt / managerUpdatedAt 없으면 updatedAt fallback
 * - self / manager computed 재계산
 */
export function normalizeCompetencyMonthRecord(raw, memberCode) {
  const base = defaultCompetencyMonthRecord(memberCode);
  const source = raw && typeof raw === 'object' ? raw : {};
  const roleId = resolveRoleId(source, memberCode);
  const { selfUpdatedAt, managerUpdatedAt, legacyUpdatedAt } = applyTimestampFallbacks(source);

  const self = normalizeEvalSide(source.self ?? base.self, roleId);
  const manager = normalizeEvalSide(source.manager ?? base.manager, roleId);

  const recordUpdatedAt = [selfUpdatedAt, managerUpdatedAt, legacyUpdatedAt]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return {
    roleId,
    self,
    manager,
    selfLocked: Boolean(source.selfLocked),
    managerLocked: Boolean(source.managerLocked),
    selfUpdatedAt: selfUpdatedAt ?? null,
    managerUpdatedAt: managerUpdatedAt ?? null,
    updatedAt: recordUpdatedAt,
  };
}

/** competencyMonths 트리 정규화 — A/B/C 외 member 코드도 보존 */
export function normalizeCompetencyMonths(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const competencyMonths = {};

  Object.entries(source).forEach(([ym, members]) => {
    if (!ym || typeof members !== 'object') return;
    const month = {};
    Object.entries(members).forEach(([memberCode, record]) => {
      if (!memberCode) return;
      month[memberCode] = normalizeCompetencyMonthRecord(record, memberCode);
    });
    if (Object.keys(month).length > 0) competencyMonths[ym] = month;
  });

  return competencyMonths;
}

/**
 * cloud snapshot 정규화
 * - competencyMonths 단독 또는 kpiOperational.competencyMonths 래핑 지원
 */
export function normalizeCompetencyCloudSnapshot(raw, { publishedAt = nowIso() } = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const snapshotAt = typeof source.publishedAt === 'string' ? source.publishedAt : publishedAt;
  const nested =
    source.kpiOperational && typeof source.kpiOperational === 'object'
      ? source.kpiOperational.competencyMonths
      : undefined;
  const competencyMonths = normalizeCompetencyMonths(source.competencyMonths ?? nested ?? {});

  const sourceMeta = source.meta && typeof source.meta === 'object' ? source.meta : {};

  return {
    version: KPI_COMPETENCY_CLOUD_SNAPSHOT_VERSION,
    publishedAt: snapshotAt,
    meta: {
      ...sourceMeta,
      updatedAt: typeof sourceMeta.updatedAt === 'string' ? sourceMeta.updatedAt : snapshotAt,
    },
    competencyMonths,
  };
}

function pickSide({
  localRec,
  remoteRec,
  sideKey,
  lockKey,
  timestampKey,
}) {
  const hasLocal = Boolean(localRec);
  const hasRemote = Boolean(remoteRec);

  if (!hasLocal && !hasRemote) return null;
  if (!hasRemote) {
    return {
      side: localRec[sideKey],
      locked: Boolean(localRec[lockKey]),
      updatedAt: localRec[timestampKey] ?? localRec.updatedAt ?? null,
    };
  }
  if (!hasLocal) {
    return {
      side: remoteRec[sideKey],
      locked: Boolean(remoteRec[lockKey]),
      updatedAt: remoteRec[timestampKey] ?? remoteRec.updatedAt ?? null,
    };
  }

  if (localRec[lockKey]) {
    return {
      side: localRec[sideKey],
      locked: true,
      updatedAt: localRec[timestampKey] ?? localRec.updatedAt ?? null,
    };
  }

  const localAt = localRec[timestampKey] ?? localRec.updatedAt ?? null;
  const remoteAt = remoteRec[timestampKey] ?? remoteRec.updatedAt ?? null;

  if (isNewer(remoteAt, localAt)) {
    return {
      side: remoteRec[sideKey],
      locked: Boolean(remoteRec[lockKey]),
      updatedAt: remoteAt,
    };
  }

  return {
    side: localRec[sideKey],
    locked: Boolean(localRec[lockKey]),
    updatedAt: localAt,
  };
}

/**
 * 단일 ym·member 레코드 self/manager 필드 단위 merge
 */
export function mergeCompetencyMonthRecord(localRaw, remoteRaw, memberCode) {
  const localRec = localRaw ? normalizeCompetencyMonthRecord(localRaw, memberCode) : null;
  const remoteRec = remoteRaw ? normalizeCompetencyMonthRecord(remoteRaw, memberCode) : null;

  if (!localRec && !remoteRec) {
    return normalizeCompetencyMonthRecord(null, memberCode);
  }

  const selfPick = pickSide({
    localRec,
    remoteRec,
    sideKey: 'self',
    lockKey: 'selfLocked',
    timestampKey: 'selfUpdatedAt',
  });
  const managerPick = pickSide({
    localRec,
    remoteRec,
    sideKey: 'manager',
    lockKey: 'managerLocked',
    timestampKey: 'managerUpdatedAt',
  });

  const roleId = localRec?.roleId ?? remoteRec?.roleId ?? resolveRoleId(null, memberCode);

  const self = normalizeEvalSide(selfPick.side, roleId);
  const manager = normalizeEvalSide(managerPick.side, roleId);

  const updatedAt = [selfPick.updatedAt, managerPick.updatedAt]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return {
    roleId,
    self,
    manager,
    selfLocked: selfPick.locked,
    managerLocked: managerPick.locked,
    selfUpdatedAt: selfPick.updatedAt,
    managerUpdatedAt: managerPick.updatedAt,
    updatedAt,
  };
}

/** competencyMonths 트리 merge */
export function mergeCompetencyMonths(localRaw, remoteRaw) {
  const local = normalizeCompetencyMonths(localRaw);
  const remote = normalizeCompetencyMonths(remoteRaw);
  const ymKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const merged = {};

  ymKeys.forEach((ym) => {
    const localMonth = local[ym] || {};
    const remoteMonth = remote[ym] || {};
    const memberKeys = new Set([...Object.keys(localMonth), ...Object.keys(remoteMonth)]);
    const month = {};

    memberKeys.forEach((memberCode) => {
      month[memberCode] = mergeCompetencyMonthRecord(
        localMonth[memberCode],
        remoteMonth[memberCode],
        memberCode
      );
    });

    if (Object.keys(month).length > 0) merged[ym] = month;
  });

  return merged;
}

/**
 * KPI operational store에 remote competency snapshot을 merge
 * - competencyMonths만 갱신, 나머지 필드는 local 그대로
 */
export function mergeCompetencyMonthsIntoKpiStore(localStore, remoteSnapshot) {
  const local = normalizeKpiOperationalStore(localStore);
  const remote = normalizeCompetencyCloudSnapshot(remoteSnapshot);
  const competencyMonths = mergeCompetencyMonths(local.competencyMonths, remote.competencyMonths);

  return {
    ...local,
    competencyMonths,
  };
}

/** 빈 competency cloud snapshot */
export function createEmptyCompetencyCloudSnapshot() {
  return normalizeCompetencyCloudSnapshot({
    publishedAt: nowIso(),
    competencyMonths: {},
  });
}

/** 테스트·디버그용 — store에서 competencyMonths만 추출 */
export function extractCompetencyMonthsFromStore(store) {
  return normalizeCompetencyMonths(normalizeKpiOperationalStore(store).competencyMonths);
}

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidCompetencyMemberCode(code) {
  return KPI_COMPETENCY_MEMBER_CODES.includes(code);
}

export function isValidCompetencyYearMonth(yearMonth) {
  return YEAR_MONTH_RE.test(String(yearMonth || ''));
}

function isAllUnmetDims(dims) {
  const values = Object.values(dims || {});
  return values.length > 0 && values.every((v) => v === DIM_UNMET);
}

/** self 평가가 기본 상태(미입력 intLevel, unmet×5)인지 */
export function isDefaultSelfEval(self) {
  return !isValidCompetencyIntLevel(self?.intLevel) && isAllUnmetDims(self?.dims);
}

/**
 * 공유 저장 가능 여부 — self.intLevel 1~5일 때만 (manager·dims·selfLocked 단독 불가)
 */
export function isCompetencyMonthRecordSaveable(raw, memberCode) {
  const rec = normalizeCompetencyMonthRecord(raw, memberCode);
  return isValidCompetencyIntLevel(rec.self?.intLevel);
}

/**
 * CompetencyPage self 저장용 — blob manager는 유지하고 self만 merge
 */
export function mergeCompetencySelfPush(existingRaw, incomingRaw, memberCode) {
  const existing = existingRaw ? normalizeCompetencyMonthRecord(existingRaw, memberCode) : null;
  const incoming = normalizeCompetencyMonthRecord(incomingRaw, memberCode);
  const combined = {
    roleId: incoming.roleId ?? existing?.roleId,
    self: incoming.self,
    selfLocked: incoming.selfLocked,
    selfUpdatedAt: incoming.selfUpdatedAt ?? incoming.updatedAt,
    manager: existing?.manager ?? incoming.manager,
    managerLocked: existing?.managerLocked ?? incoming.managerLocked,
    managerUpdatedAt: existing?.managerUpdatedAt ?? incoming.managerUpdatedAt,
  };
  return mergeCompetencyMonthRecord(existing, combined, memberCode);
}

/** cloud snapshot에 단일 member·month competency upsert */
export function mergeMemberIntoCompetencyCloudSnapshot(
  snapshot,
  memberCode,
  yearMonth,
  competencyMonth,
  { updatedAt = nowIso() } = {}
) {
  if (!isValidCompetencyMemberCode(memberCode)) {
    throw new Error('memberCode는 A/B/C 중 하나여야 합니다.');
  }
  if (!isValidCompetencyYearMonth(yearMonth)) {
    throw new Error('yearMonth는 YYYY-MM 형식이어야 합니다.');
  }

  const current = normalizeCompetencyCloudSnapshot(snapshot);
  const existing = current.competencyMonths[yearMonth]?.[memberCode];
  const merged = mergeCompetencySelfPush(
    existing,
    { ...competencyMonth, updatedAt },
    memberCode
  );

  if (!existing && !isCompetencyMonthRecordSaveable(merged, memberCode)) {
    const err = new Error('저장할 역량 평가 내용이 없습니다.');
    err.code = 'EMPTY_RECORD';
    throw err;
  }

  const competencyMonths = {
    ...current.competencyMonths,
    [yearMonth]: {
      ...(current.competencyMonths[yearMonth] || {}),
      [memberCode]: merged,
    },
  };

  return normalizeCompetencyCloudSnapshot({
    publishedAt: updatedAt,
    meta: { ...current.meta, updatedAt },
    competencyMonths,
  });
}

/** API GET/POST 응답 형식 */
export function formatCompetencyCloudApiPayload(snapshot) {
  const normalized = normalizeCompetencyCloudSnapshot(snapshot);
  return {
    version: normalized.version,
    publishedAt: normalized.publishedAt,
    meta: normalized.meta,
    kpiOperational: {
      competencyMonths: normalized.competencyMonths,
    },
  };
}
