import { describe, expect, it } from 'vitest';
import { defaultQuarterRecord } from '../src/constants/kpiOperationalStore.js';
import { syncQuarterLevelsFromCompetencyMonths } from '../src/utils/kpiQuarterLevelSync.js';

const mrec = (mgr, locked = false) => ({
  self: { computed: { proposed: null } },
  manager: { computed: { proposed: mgr } },
  managerLocked: locked,
});

const store = (months, quarters = {}) => ({ competencyMonths: months, quarters });

describe('분기 레벨 자동 반영', () => {
  it('분기 마지막 달 레벨을 팀장 확정 전에도 분기 레벨로 반영하고 종합·등급을 다시 계산한다', () => {
    const base = store({ '2026-07': { C: mrec(3.8, true) }, '2026-09': { C: mrec(4.0, false) } });
    const { store: next, changed, updates } = syncQuarterLevelsFromCompetencyMonths(base, { use4060: false });
    expect(changed).toBe(true);
    expect(updates).toEqual([{ yq: '2026-3Q', memberCode: 'C', level: 4 }]);
    const q = next.quarters['2026-3Q'].C.quarter;
    expect(q.level).toBe(4);
    expect(q.levelAuto).toBe(true);
    expect(q.composite).toBeGreaterThan(0);
  });

  it('마지막 달이 아닌 달의 값만 있으면 반영하지 않는다', () => {
    const base = store({ '2026-07': { C: mrec(3.8, true) }, '2026-08': { C: mrec(4.2, true) } });
    expect(syncQuarterLevelsFromCompetencyMonths(base, { use4060: false }).changed).toBe(false);
  });

  it('마지막 달에 팀장 평가 점수가 없으면 건드리지 않는다', () => {
    const quarters = { '2026-3Q': { C: { ...defaultQuarterRecord('C'), quarter: { ...defaultQuarterRecord('C').quarter, level: 3.5, levelAuto: true } } } };
    const base = store({ '2026-09': { C: mrec(0, false) } }, quarters);
    const r = syncQuarterLevelsFromCompetencyMonths(base, { use4060: false });
    expect(r.changed).toBe(false);
    expect(r.store.quarters['2026-3Q'].C.quarter.level).toBe(3.5);
  });

  it('분기 확정된 기록은 바꾸지 않는다', () => {
    const rec = defaultQuarterRecord('C');
    const quarters = { '2026-3Q': { C: { ...rec, quarter: { ...rec.quarter, level: 3, levelAuto: true, locked: true } } } };
    const r = syncQuarterLevelsFromCompetencyMonths(store({ '2026-09': { C: mrec(4.5, true) } }, quarters), { use4060: false });
    expect(r.changed).toBe(false);
    expect(r.store.quarters['2026-3Q'].C.quarter.level).toBe(3);
  });

  it('팀장이 수동으로 조정한 레벨은 보호한다', () => {
    const rec = defaultQuarterRecord('C');
    const quarters = { '2026-3Q': { C: { ...rec, quarter: { ...rec.quarter, level: 3.3, levelAuto: false } } } };
    const r = syncQuarterLevelsFromCompetencyMonths(store({ '2026-09': { C: mrec(4.5, true) } }, quarters), { use4060: false });
    expect(r.changed).toBe(false);
    expect(r.store.quarters['2026-3Q'].C.quarter.level).toBe(3.3);
  });

  it('자동 반영된 값은 마지막 달 점수가 바뀌면 다시 갱신하고, 같으면 변경 없음', () => {
    const first = syncQuarterLevelsFromCompetencyMonths(store({ '2026-09': { C: mrec(4.0, false) } }), { use4060: false });
    const same = syncQuarterLevelsFromCompetencyMonths(first.store, { use4060: false });
    expect(same.changed).toBe(false);
    const months = { '2026-09': { C: mrec(4.6, true) } };
    const updated = syncQuarterLevelsFromCompetencyMonths({ ...first.store, competencyMonths: months }, { use4060: false });
    expect(updated.changed).toBe(true);
    expect(updated.store.quarters['2026-3Q'].C.quarter.level).toBe(4.6);
  });

  it('여러 분기·구성원을 한 번에 처리한다', () => {
    const base = store({ '2026-06': { A: mrec(3.2, true), B: mrec(3.4, true) }, '2026-09': { C: mrec(4.0, false) } });
    const r = syncQuarterLevelsFromCompetencyMonths(base, { use4060: false });
    expect(r.updates.map((u) => `${u.yq}:${u.memberCode}`).sort()).toEqual(['2026-2Q:A', '2026-2Q:B', '2026-3Q:C']);
  });
});
