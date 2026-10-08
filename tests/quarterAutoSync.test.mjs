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
