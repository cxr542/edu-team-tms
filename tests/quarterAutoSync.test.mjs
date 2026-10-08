import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultQuarterRecord } from '../src/constants/kpiOperationalStore.js';
import { resetQuarterAutoSyncSession, runQuarterAutoSync } from '../src/hooks/useQuarterAutoSync.js';

const T1 = '2026-10-01T00:00:00.000Z';

const submittedRec = () => ({
  ...defaultQuarterRecord('C'),
  leaderDetail: { memberSelf: '4', managerScore: '', note: '', submissionStatus: 'submitted', submittedAt: T1, submittedBy: 'C' },
});

function setup({ pull, save }) {
  const journal = {
    pullKpi3QuarterCloudSnapshot: vi.fn(async () => pull),
    saveKpi3QuarterCloudSnapshot: vi.fn(async () => save),
  };
  const onToast = vi.fn();
  const run = (role, quarterRec) =>
    runQuarterAutoSync({ journal, role, memberCode: 'C', year: 2026, monthIndex: 8, yq: '2026-3Q', quarterRec, onToast });
  return { journal, onToast, run };
}

describe('분기 공유 자동 동기화 (화면 진입 시)', () => {
  beforeEach(() => resetQuarterAutoSyncSession());

  it('구성원: 공유본에 없으면 한 번 자동 저장하고 알린다', async () => {
    const { journal, onToast, run } = setup({ pull: { ok: true, remote: { quarters: {} }, changedCount: 0 }, save: { ok: true } });
    expect(await run('member', submittedRec())).toBe('pushed');
    expect(journal.saveKpi3QuarterCloudSnapshot).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('자동 저장'));
    expect(await run('member', submittedRec())).toBe('skipped');
    expect(journal.saveKpi3QuarterCloudSnapshot).toHaveBeenCalledTimes(1);
  });

  it('구성원: 이미 공유돼 있으면 저장하지 않는다', async () => {
    const remote = { quarters: { '2026-3Q': { C: submittedRec() } } };
    const { journal, run } = setup({ pull: { ok: true, remote, changedCount: 0 }, save: { ok: true } });
    expect(await run('member', submittedRec())).toBe('in-sync');
    expect(journal.saveKpi3QuarterCloudSnapshot).not.toHaveBeenCalled();
  });

  it('구성원: 저장 실패는 토스트로 알리고 다음 진입에서 재시도한다', async () => {
    const { journal, onToast, run } = setup({
      pull: { ok: true, remote: { quarters: {} }, changedCount: 0 },
      save: { ok: false, reason: 'error', error: new Error('boom') },
    });
    expect(await run('member', submittedRec())).toBe('push-failed');
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('실패'));
    await run('member', submittedRec());
    expect(journal.saveKpi3QuarterCloudSnapshot).toHaveBeenCalledTimes(2);
  });

  it('구성원: 제출 내용이 없으면 저장하지 않는다', async () => {
    const { journal, run } = setup({ pull: { ok: true, remote: { quarters: {} }, changedCount: 0 }, save: { ok: true } });
    expect(await run('member', defaultQuarterRecord('C'))).toBe('in-sync');
    expect(journal.saveKpi3QuarterCloudSnapshot).not.toHaveBeenCalled();
  });

  it('가져오기 실패는 알리고 재시도 가능', async () => {
    const { onToast, run } = setup({ pull: { ok: false, reason: 'error', error: new Error('503') }, save: { ok: true } });
    expect(await run('member', submittedRec())).toBe('pull-failed');
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('확인하지 못했습니다'));
    expect(await run('member', submittedRec())).toBe('pull-failed');
  });

  it('팀장: 가져온 건수가 있으면 알리고 저장은 하지 않는다', async () => {
    const { journal, onToast, run } = setup({ pull: { ok: true, remote: { quarters: {} }, changedCount: 2 }, save: { ok: true } });
    expect(await run('manager', submittedRec())).toBe('pulled');
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('2건'));
    expect(journal.saveKpi3QuarterCloudSnapshot).not.toHaveBeenCalled();
  });
});

import { resetCompetencyAutoPullSession, runCompetencyAutoPull } from '../src/hooks/useQuarterAutoSync.js';

describe('월간 역량 평가 자동 가져오기 (화면 진입 시)', () => {
  beforeEach(() => resetCompetencyAutoPullSession());
  const make = (result) => {
    const journal = { pullCompetencyCloudSnapshot: vi.fn(async () => result) };
    const onToast = vi.fn();
    return { journal, onToast, run: () => runCompetencyAutoPull({ journal, role: 'manager', yq: '2026-3Q', onToast }) };
  };

  it('변경이 있으면 알리고, 세션 내 같은 화면은 다시 가져오지 않는다', async () => {
    const { journal, onToast, run } = make({ ok: true, changed: true });
    expect(await run()).toBe('pulled');
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('자동으로 반영'));
    expect(await run()).toBe('skipped');
    expect(journal.pullCompetencyCloudSnapshot).toHaveBeenCalledTimes(1);
  });

  it('변경이 없으면 조용히 끝난다', async () => {
    const { onToast, run } = make({ ok: true, changed: false });
    expect(await run()).toBe('in-sync');
    expect(onToast).not.toHaveBeenCalled();
  });

  it('실패하면 알리고 다음 진입에서 재시도한다', async () => {
    const { journal, onToast, run } = make({ ok: false, reason: 'error', error: new Error('503') });
    expect(await run()).toBe('failed');
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('확인하지 못했습니다'));
    await run();
    expect(journal.pullCompetencyCloudSnapshot).toHaveBeenCalledTimes(2);
  });

  it('조회 전용이면 알림 없이 재시도 가능 상태로 둔다', async () => {
    const { onToast, run } = make({ ok: false, reason: 'read-only' });
    expect(await run()).toBe('failed');
    expect(onToast).not.toHaveBeenCalled();
  });
});

import { listUnsharedManagerLocks } from '../src/utils/kpiOperationalCloudSnapshot.js';

const monthRec = (over = {}) => ({
  self: { intLevel: 3, dims: {} },
  manager: { intLevel: 4, dims: {} },
  selfLocked: true,
  managerLocked: true,
  selfUpdatedAt: '2026-08-01T00:00:00.000Z',
  managerUpdatedAt: '2026-08-02T00:00:00.000Z',
  ...over,
});

describe('팀장 확정 보충 저장 대상', () => {
  it('로컬에서 확정됐지만 공유본에 확정이 없는 월만 고른다', () => {
    const local = {
      '2026-07': { C: monthRec(), B: monthRec() },
      '2026-08': { C: monthRec({ managerLocked: false }) },
    };
    const remote = { '2026-07': { B: monthRec() } };
    const t = listUnsharedManagerLocks(local, remote);
    expect(t.map((x) => `${x.ym}:${x.memberCode}`)).toEqual(['2026-07:C']);
  });

  it('자체평가가 비어 저장 불가한 기록은 제외한다', () => {
    const local = { '2026-07': { C: monthRec({ self: { intLevel: 0, dims: {} } }) } };
    expect(listUnsharedManagerLocks(local, {})).toEqual([]);
  });

  it('팀장 자동 가져오기가 보충 저장하고 알린다', async () => {
    resetCompetencyAutoPullSession();
    const store = { competencyMonths: { '2026-07': { C: monthRec() } } };
    const journal = {
      pullCompetencyCloudSnapshot: vi.fn(async () => ({ ok: true, changed: false, store, remote: { kpiOperational: { competencyMonths: {} } } })),
      saveCompetencyMemberCloudSnapshot: vi.fn(async () => ({ ok: true })),
    };
    const onToast = vi.fn();
    expect(await runCompetencyAutoPull({ journal, role: 'manager', yq: '2026-3Q', onToast })).toBe('backfilled');
    expect(journal.saveCompetencyMemberCloudSnapshot).toHaveBeenCalledWith('C', '2026-07', expect.objectContaining({ managerLocked: true }));
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('1건'));
  });

  it('구성원은 보충 저장하지 않는다', async () => {
    resetCompetencyAutoPullSession();
    const store = { competencyMonths: { '2026-07': { C: monthRec() } } };
    const journal = {
      pullCompetencyCloudSnapshot: vi.fn(async () => ({ ok: true, changed: false, store, remote: {} })),
      saveCompetencyMemberCloudSnapshot: vi.fn(async () => ({ ok: true })),
    };
    await runCompetencyAutoPull({ journal, role: 'member', yq: '2026-3Q', onToast: vi.fn() });
    expect(journal.saveCompetencyMemberCloudSnapshot).not.toHaveBeenCalled();
  });
});
