import { TEAM_KPI_MEMBERS } from '../constants/kpiMembers';
import {
  defaultCompetencyMonthRecord,
  normalizeKpiOperationalStore,
} from '../constants/kpiOperationalStore';
import { mapMemberRoleToCompetency } from '../constants/competencyRubric';
import { computeCompetencyEval } from './competencyScore';

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
  const intLevel = side?.intLevel ?? base.intLevel;
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
