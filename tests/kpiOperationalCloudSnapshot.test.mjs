import { describe, expect, it } from 'vitest';
import { DIM_MET } from '../src/constants/competencyRubric.js';
import { createEmptyKpiOperationalStore } from '../src/constants/kpiOperationalStore.js';
import {
  formatCompetencyCloudApiPayload,
  isCompetencyMonthRecordSaveable,
  mergeCompetencyMonthRecord,
  mergeCompetencyMonths,
  mergeCompetencyMonthsIntoKpiStore,
  mergeCompetencySelfPush,
  mergeMemberIntoCompetencyCloudSnapshot,
  normalizeCompetencyCloudSnapshot,
  normalizeCompetencyMonthRecord,
} from '../src/utils/kpiOperationalCloudSnapshot.js';

const YM = '2026-06';

function fullDims() {
  return {
    autonomy: DIM_MET,
    scope: DIM_MET,
    collaboration: DIM_MET,
    quality: DIM_MET,
    expertise: DIM_MET,
  };
}

function side(level, dims = fullDims()) {
  return { intLevel: level, dims };
}

function competencyRecord({
  memberCode = 'B',
  selfLevel = 0,
  managerLevel = 0,
  selfUpdatedAt = null,
  managerUpdatedAt = null,
  updatedAt = null,
  selfLocked = false,
  managerLocked = false,
} = {}) {
  const record = {
    self: side(selfLevel),
    manager: side(managerLevel),
    selfLocked,
    managerLocked,
  };
  if (selfUpdatedAt) record.selfUpdatedAt = selfUpdatedAt;
  if (managerUpdatedAt) record.managerUpdatedAt = managerUpdatedAt;
  if (updatedAt) record.updatedAt = updatedAt;
  return normalizeCompetencyMonthRecord(record, memberCode);
}

function storeWithCompetency(competencyMonths, extra = {}) {
  return {
    ...createEmptyKpiOperationalStore(),
    months: { '2026-06': { A: { monthly01: { work: 1 } } } },
    quarters: { '2026-2Q': { B: { quarter: { level: 2 } } } },
    kpiWeekMemos: { '2026-W24': 'memo' },
    kpi2RowStatus: { '2026-06-01|t1': 'approved' },
    competencyMonths,
    ...extra,
  };
}

describe('kpiOperationalCloudSnapshot', () => {
  it('normalizes empty or partial competencyMonths safely', () => {
    expect(normalizeCompetencyCloudSnapshot(null).competencyMonths).toEqual({});
    const snap = normalizeCompetencyCloudSnapshot({
      publishedAt: '2026-06-10T00:00:00.000Z',
      competencyMonths: {
        [YM]: { B: { self: side(2), updatedAt: '2026-06-09T00:00:00.000Z' } },
      },
    });
    expect(snap.competencyMonths[YM].B.self.intLevel).toBe(2);
    expect(snap.competencyMonths[YM].B.selfUpdatedAt).toBe('2026-06-09T00:00:00.000Z');
    expect(snap.competencyMonths[YM].B.managerUpdatedAt).toBe('2026-06-09T00:00:00.000Z');
  });

  it('preserves non A/B/C member codes in competencyMonths', () => {
    const merged = mergeCompetencyMonths(
      {},
      {
        [YM]: {
          X: { self: side(1), selfUpdatedAt: '2026-06-01T00:00:00.000Z' },
        },
      }
    );
    expect(merged[YM].X.self.intLevel).toBe(1);
  });

  it('uses legacy updatedAt as fallback timestamp for both sides', () => {
    const local = competencyRecord({
      selfLevel: 2,
      managerLevel: 3,
      updatedAt: '2026-06-01T10:00:00.000Z',
    });
    const remote = competencyRecord({
      selfLevel: 9,
      managerLevel: 9,
      selfUpdatedAt: '2026-06-02T10:00:00.000Z',
      managerUpdatedAt: '2026-06-01T09:00:00.000Z',
    });

    const merged = mergeCompetencyMonthRecord(local, remote, 'B');

    expect(merged.self.intLevel).toBe(9);
    expect(merged.manager.intLevel).toBe(3);
  });

  it('adds member/month that exists only on remote', () => {
    const merged = mergeCompetencyMonths(
      {},
      {
        [YM]: {
          C: competencyRecord({
            memberCode: 'C',
            selfLevel: 4,
            selfUpdatedAt: '2026-06-03T00:00:00.000Z',
          }),
        },
      }
    );
    expect(merged[YM].C.self.intLevel).toBe(4);
  });

  it('keeps newer local self when unlocked', () => {
    const local = competencyRecord({
      selfLevel: 5,
      selfUpdatedAt: '2026-06-05T00:00:00.000Z',
    });
    const remote = competencyRecord({
      selfLevel: 2,
      selfUpdatedAt: '2026-06-04T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.self.intLevel).toBe(5);
  });

  it('applies newer remote self when unlocked', () => {
    const local = competencyRecord({
      selfLevel: 2,
      selfUpdatedAt: '2026-06-04T00:00:00.000Z',
    });
    const remote = competencyRecord({
      selfLevel: 5,
      selfUpdatedAt: '2026-06-05T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.self.intLevel).toBe(5);
  });

  it('protects local self when selfLocked even if remote is newer', () => {
    const local = competencyRecord({
      selfLevel: 3,
      selfUpdatedAt: '2026-06-01T00:00:00.000Z',
      selfLocked: true,
    });
    const remote = competencyRecord({
      selfLevel: 9,
      selfUpdatedAt: '2026-06-09T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.self.intLevel).toBe(3);
    expect(merged.selfLocked).toBe(true);
  });

  it('keeps newer local manager when unlocked', () => {
    const local = competencyRecord({
      managerLevel: 4,
      managerUpdatedAt: '2026-06-06T00:00:00.000Z',
    });
    const remote = competencyRecord({
      managerLevel: 1,
      managerUpdatedAt: '2026-06-05T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.manager.intLevel).toBe(4);
  });

  it('applies newer remote manager when unlocked', () => {
    const local = competencyRecord({
      managerLevel: 1,
      managerUpdatedAt: '2026-06-05T00:00:00.000Z',
    });
    const remote = competencyRecord({
      managerLevel: 4,
      managerUpdatedAt: '2026-06-06T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.manager.intLevel).toBe(4);
  });

  it('protects local manager when managerLocked even if remote is newer', () => {
    const local = competencyRecord({
      managerLevel: 3,
      managerUpdatedAt: '2026-06-01T00:00:00.000Z',
      managerLocked: true,
    });
    const remote = competencyRecord({
      managerLevel: 9,
      managerUpdatedAt: '2026-06-09T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.manager.intLevel).toBe(3);
    expect(merged.managerLocked).toBe(true);
  });

  it('merges self from remote and keeps local manager independently', () => {
    const local = competencyRecord({
      selfLevel: 1,
      managerLevel: 7,
      selfUpdatedAt: '2026-06-01T00:00:00.000Z',
      managerUpdatedAt: '2026-06-08T00:00:00.000Z',
    });
    const remote = competencyRecord({
      selfLevel: 6,
      managerLevel: 2,
      selfUpdatedAt: '2026-06-07T00:00:00.000Z',
      managerUpdatedAt: '2026-06-02T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.self.intLevel).toBe(6);
    expect(merged.manager.intLevel).toBe(7);
  });

  it('merges manager from remote and keeps local self independently', () => {
    const local = competencyRecord({
      selfLevel: 8,
      managerLevel: 1,
      selfUpdatedAt: '2026-06-08T00:00:00.000Z',
      managerUpdatedAt: '2026-06-01T00:00:00.000Z',
    });
    const remote = competencyRecord({
      selfLevel: 2,
      managerLevel: 6,
      selfUpdatedAt: '2026-06-02T00:00:00.000Z',
      managerUpdatedAt: '2026-06-07T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.self.intLevel).toBe(8);
    expect(merged.manager.intLevel).toBe(6);
  });

  it('recomputes computed fields after merge', () => {
    const local = competencyRecord({
      selfLevel: 2,
      selfUpdatedAt: '2026-06-08T00:00:00.000Z',
    });
    const remote = competencyRecord({
      selfLevel: 3,
      selfUpdatedAt: '2026-06-09T00:00:00.000Z',
    });
    const merged = mergeCompetencyMonthRecord(local, remote, 'B');
    expect(merged.self.computed?.proposed).toBeGreaterThan(0);
    expect(merged.manager.computed?.proposed).toBeDefined();
  });

  it('mergeCompetencySelfPush keeps remote manager while updating self', () => {
    const existing = competencyRecord({
      selfLevel: 1,
      managerLevel: 4,
      managerUpdatedAt: '2026-06-08T00:00:00.000Z',
    });
    const incoming = competencyRecord({
      selfLevel: 5,
      managerLevel: 9,
      selfUpdatedAt: '2026-06-09T00:00:00.000Z',
      managerUpdatedAt: '2026-06-09T00:00:00.000Z',
    });
    const merged = mergeCompetencySelfPush(existing, incoming, 'B');
    expect(merged.self.intLevel).toBe(5);
    expect(merged.manager.intLevel).toBe(4);
  });

  it('isCompetencyMonthRecordSaveable — intLevel 또는 dims가 있으면 저장 가능', () => {
    // 기본 dims가 unmet으로 채워지므로 빈 객체도 normalize 후 dims 존재
    expect(isCompetencyMonthRecordSaveable({}, 'B')).toBe(true);
    expect(isCompetencyMonthRecordSaveable(competencyRecord({ selfLevel: 2 }), 'B')).toBe(true);
  });

  it('mergeMemberIntoCompetencyCloudSnapshot upserts one member/month only', () => {
    const base = normalizeCompetencyCloudSnapshot({
      competencyMonths: {
        [YM]: {
          A: competencyRecord({ memberCode: 'A', selfLevel: 1, selfUpdatedAt: '2026-06-01T00:00:00.000Z' }),
        },
      },
    });
    const next = mergeMemberIntoCompetencyCloudSnapshot(
      base,
      'B',
      YM,
      competencyRecord({ memberCode: 'B', selfLevel: 3, selfUpdatedAt: '2026-06-02T00:00:00.000Z' }),
      { updatedAt: '2026-06-02T00:00:00.000Z' }
    );
    expect(next.competencyMonths[YM].A.self.intLevel).toBe(1);
    expect(next.competencyMonths[YM].B.self.intLevel).toBe(3);
  });

  it('formatCompetencyCloudApiPayload wraps competencyMonths under kpiOperational', () => {
    const payload = formatCompetencyCloudApiPayload(
      normalizeCompetencyCloudSnapshot({
        competencyMonths: { [YM]: { B: competencyRecord({ selfLevel: 2 }) } },
      })
    );
    expect(payload.version).toBe(1);
    expect(payload.kpiOperational.competencyMonths[YM].B.self.intLevel).toBe(2);
  });

  it('mergeCompetencyMonthsIntoKpiStore preserves non-competency store fields', () => {
    const local = storeWithCompetency({
      [YM]: {
        B: competencyRecord({
          selfLevel: 2,
          selfUpdatedAt: '2026-06-01T00:00:00.000Z',
        }),
      },
    });
    const remote = normalizeCompetencyCloudSnapshot({
      competencyMonths: {
        [YM]: {
          B: competencyRecord({
            selfLevel: 5,
            selfUpdatedAt: '2026-06-09T00:00:00.000Z',
          }),
        },
      },
    });

    const merged = mergeCompetencyMonthsIntoKpiStore(local, remote);

    expect(merged.competencyMonths[YM].B.self.intLevel).toBe(5);
    expect(merged.months['2026-06'].A.monthly01.work).toBe(1);
    expect(merged.quarters['2026-2Q'].B.quarter.level).toBe(2);
    expect(merged.kpiWeekMemos['2026-W24']).toBe('memo');
    expect(merged.kpi2RowStatus['2026-06-01|t1']).toBe('approved');
  });
});
