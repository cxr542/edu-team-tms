import { describe, expect, it } from 'vitest';
import {
  createEmptyKpiOperationalStore,
  defaultCompetencyQuarterRecord,
  ensureCompetencyQuarterMember,
  isValidQuarterKey,
  quarterMonthKeysFromYq,
} from '../src/constants/kpiOperationalStore.js';
import { DIM_MET, DIM_UNMET } from '../src/constants/competencyRubric.js';
import {
  patchCompetencyQuarterManager,
  patchCompetencyQuarterSelf,
  patchLockCompetencyQuarter,
  readCompetencyQuarter,
} from '../src/hooks/useKpiOperational.js';
import {
  buildCompetencyQuartersFromMonths,
  isValidCompetencyIntLevel,
  pickCompetencyMonthRecordForQuarter,
} from '../src/utils/competencyScore.js';

const YQ = '2026-2Q';

function defaultUnmetDims() {
  return {
    autonomy: DIM_UNMET,
    scope: DIM_UNMET,
    collaboration: DIM_UNMET,
    quality: DIM_UNMET,
    expertise: DIM_UNMET,
  };
}

function monthRecord({ selfLevel = 0, managerLevel = 0, managerLocked = false, updatedAt }) {
  return {
    roleId: 'default',
    self: { intLevel: selfLevel, dims: defaultUnmetDims() },
    manager: { intLevel: managerLevel, dims: defaultUnmetDims() },
    selfLocked: false,
    managerLocked,
    updatedAt: updatedAt || null,
  };
}

describe('competencyQuarters Phase 1', () => {
  it('기본 store에 competencyQuarters {}', () => {
    const store = createEmptyKpiOperationalStore();
    expect(store.competencyQuarters).toEqual({});
    expect(store.competencyMonths).toEqual({});
  });

  it('quarterKey helper — 2026-2Q 및 월 키', () => {
    expect(isValidQuarterKey('2026-2Q')).toBe(true);
    expect(isValidQuarterKey('2026-13Q')).toBe(false);
    expect(quarterMonthKeysFromYq('2026-2Q')).toEqual(['2026-04', '2026-05', '2026-06']);
  });

  it('readCompetencyQuarter — 기본 record', () => {
    const store = createEmptyKpiOperationalStore();
    const rec = readCompetencyQuarter(store, YQ, 'B');
    expect(rec.roleId).toBe('default');
    expect(rec.self.dims.autonomy).toBe(DIM_UNMET);
    expect(rec.self.computed.proposed).toBeNull();
    expect(rec.selfLocked).toBe(false);
  });

  it('patchCompetencyQuarterSelf — self만 갱신, manager 보존', () => {
    let store = ensureCompetencyQuarterMember(createEmptyKpiOperationalStore(), YQ, 'B');
    store = {
      ...store,
      competencyQuarters: {
        [YQ]: {
          B: {
            ...store.competencyQuarters[YQ].B,
            manager: {
              intLevel: 4,
              dims: {
                autonomy: DIM_MET,
                scope: DIM_MET,
                collaboration: DIM_UNMET,
                quality: DIM_UNMET,
                expertise: DIM_UNMET,
              },
            },
            managerLocked: true,
          },
        },
      },
    };
    const beforeMgr = readCompetencyQuarter(store, YQ, 'B').manager.intLevel;
    const next = patchCompetencyQuarterSelf(store, YQ, 'B', { intLevel: 3 });
    const rec = readCompetencyQuarter(next, YQ, 'B');
    expect(rec.self.intLevel).toBe(3);
    expect(rec.manager.intLevel).toBe(beforeMgr);
    expect(rec.managerLocked).toBe(true);
    expect(rec.updatedAt).toBeTruthy();
  });

  it('patchCompetencyQuarterManager — manager만 갱신, self 보존', () => {
    let store = patchCompetencyQuarterSelf(
      ensureCompetencyQuarterMember(createEmptyKpiOperationalStore(), YQ, 'B'),
      YQ,
      'B',
      { intLevel: 2 }
    );
    const selfLevel = readCompetencyQuarter(store, YQ, 'B').self.intLevel;
    store = patchCompetencyQuarterManager(store, YQ, 'B', { intLevel: 5 });
    const rec = readCompetencyQuarter(store, YQ, 'B');
    expect(rec.self.intLevel).toBe(selfLevel);
    expect(rec.manager.intLevel).toBe(5);
  });

  it('patchLockCompetencyQuarter — self/manager lock', () => {
    let store = patchCompetencyQuarterSelf(
      ensureCompetencyQuarterMember(createEmptyKpiOperationalStore(), YQ, 'B'),
      YQ,
      'B',
      { intLevel: 2 }
    );
    const selfLock = patchLockCompetencyQuarter(store, YQ, 'B', { side: 'self' });
    expect(selfLock.ok).toBe(true);
    expect(readCompetencyQuarter(selfLock.store, YQ, 'B').selfLocked).toBe(true);

    const mgrLock = patchLockCompetencyQuarter(selfLock.store, YQ, 'B', { side: 'manager' });
    expect(mgrLock.ok).toBe(true);
    expect(readCompetencyQuarter(mgrLock.store, YQ, 'B').managerLocked).toBe(true);
  });

  it('invalid intLevel이면 self lock 차단', () => {
    const store = ensureCompetencyQuarterMember(createEmptyKpiOperationalStore(), YQ, 'B');
    const r = patchLockCompetencyQuarter(store, YQ, 'B', { side: 'self' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid-int-level');
  });

  it('기본 dims unmet × 5', () => {
    const rec = defaultCompetencyQuarterRecord('B');
    expect(Object.values(rec.self.dims).every((v) => v === DIM_UNMET)).toBe(true);
    expect(isValidCompetencyIntLevel(rec.self.intLevel)).toBe(false);
  });

  it('pickCompetencyMonthRecordForQuarter — managerLocked 우선', () => {
    const competencyMonths = {
      '2026-04': { B: monthRecord({ managerLevel: 2, updatedAt: '2026-04-10T00:00:00.000Z' }) },
      '2026-05': {
        B: monthRecord({
          managerLevel: 4,
          managerLocked: true,
          updatedAt: '2026-05-01T00:00:00.000Z',
        }),
      },
      '2026-06': {
        B: monthRecord({
          managerLevel: 5,
          managerLocked: true,
          updatedAt: '2026-06-15T00:00:00.000Z',
        }),
      },
    };
    const picked = pickCompetencyMonthRecordForQuarter(competencyMonths, YQ, 'B');
    expect(picked.manager.intLevel).toBe(5);
    expect(picked.managerLocked).toBe(true);
  });

  it('buildCompetencyQuartersFromMonths — 분기별 초안 생성', () => {
    const competencyMonths = {
      '2026-04': { B: monthRecord({ selfLevel: 1 }) },
      '2026-05': { B: monthRecord({ selfLevel: 2, managerLocked: true }) },
      '2026-06': { A: monthRecord({ selfLevel: 3 }) },
    };
    const quarters = buildCompetencyQuartersFromMonths(competencyMonths);
    expect(quarters['2026-2Q'].B.self.intLevel).toBe(2);
    expect(quarters['2026-2Q'].A.self.intLevel).toBe(3);
  });
});
