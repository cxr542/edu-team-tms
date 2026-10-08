import { describe, expect, it } from 'vitest';
import { defaultQuarterRecord } from '../src/constants/kpiOperationalStore.js';
import {
  isQuarterRecordSaveable,
  mergeMemberIntoQuarterCloudSnapshot,
  mergeQuarterPush,
  mergeQuartersIntoKpiStore,
  needsQuarterBackfillPush,
  normalizeQuarterCloudSnapshot,
  pickSharedQuarterRecord,
} from '../src/utils/kpiQuarterCloudSnapshot.js';

const T1 = '2026-10-01T00:00:00.000Z';
const T2 = '2026-10-02T00:00:00.000Z';
const T3 = '2026-10-03T00:00:00.000Z';

function memberRec(patch = {}) {
  const rec = defaultQuarterRecord('C');
  return { ...rec, ...patch };
}

describe('분기 제출 공유 — 공유 슬라이스', () => {
  it('memos 는 공유하지 않는다', () => {
    const picked = pickSharedQuarterRecord({ ...memberRec(), memos: [{ text: '비공개' }] });
    expect(picked.memos).toBeUndefined();
  });

  it('제출·입력 흔적이 없으면 저장 대상이 아님', () => {
    expect(isQuarterRecordSaveable(memberRec())).toBe(false);
    expect(
      isQuarterRecordSaveable(memberRec({ leaderDetail: { memberSelf: '4', managerScore: '', note: '' } }))
    ).toBe(true);
    expect(
      isQuarterRecordSaveable(
        memberRec({ dmDetail: { submissionStatus: 'submitted', submittedAt: T1 } })
      )
    ).toBe(true);
  });
});

describe('분기 제출 공유 — push 병합(구성원)', () => {
  const submitted = (extra = {}) =>
    memberRec({
      leaderDetail: {
        memberSelf: '4',
        managerScore: '',
        note: '',
        submissionStatus: 'submitted',
        submittedAt: T1,
        submittedBy: 'C',
        ...extra,
      },
    });

  it('구성원 제출이 공유본에 반영된다', () => {
    const { record, applied } = mergeQuarterPush(null, submitted(), 'member', { updatedAt: T2 });
    expect(record.leaderDetail.submissionStatus).toBe('submitted');
    expect(record.leaderDetail.memberSelf).toBe('4');
    expect(applied).toContain('leaderDetail');
  });

  it('구성원은 팀장 소유 managerScore 를 덮어쓸 수 없다', () => {
    const existing = pickSharedQuarterRecord(
      memberRec({ leaderDetail: { memberSelf: '3', managerScore: '5', note: '', submissionStatus: 'submitted', submittedAt: T1 } })
    );
    const { record } = mergeQuarterPush(existing, submitted({ managerScore: '1' }), 'member', { updatedAt: T2 });
    expect(record.leaderDetail.managerScore).toBe('5');
    expect(record.leaderDetail.memberSelf).toBe('4');
  });

  it('승인된 섹션은 구성원 push 가 무시된다', () => {
    const existing = pickSharedQuarterRecord(
      memberRec({ leaderDetail: { memberSelf: '3', managerScore: '', note: '', submissionStatus: 'approved', submittedAt: T1, reviewedAt: T2 } })
    );
    const { record, skipped } = mergeQuarterPush(existing, submitted({ memberSelf: '1' }), 'member', { updatedAt: T3 });
    expect(skipped).toContain('leaderDetail');
    expect(record.leaderDetail.memberSelf).toBe('3');
    expect(record.leaderDetail.submissionStatus).toBe('approved');
  });

  it('확정(locked)된 분기는 구성원 push 를 모두 무시한다', () => {
    const existing = pickSharedQuarterRecord(memberRec({ quarter: { ...memberRec().quarter, locked: true } }));
    const { skipped } = mergeQuarterPush(existing, submitted(), 'member', { updatedAt: T3 });
    expect(skipped).toEqual(['dmDetail', 'leaderDetail', 'practiceDetail']);
  });

  it('구성원은 approved/rejected 상태나 quarter 점수를 올릴 수 없다', () => {
    const forged = memberRec({
      leaderDetail: { memberSelf: '5', managerScore: '', note: '', submissionStatus: 'approved', submittedAt: T1, reviewedAt: T2 },
      quarter: { ...memberRec().quarter, level: 5, locked: true },
    });
    const { record, skipped } = mergeQuarterPush(null, forged, 'member', { updatedAt: T3 });
    expect(skipped).toContain('leaderDetail');
    expect(record.quarter.level).toBe(0);
    expect(record.quarter.locked).toBe(false);
  });

  it('반려 후 재제출 전의 오래된 push 는 무시, 재제출은 반영', () => {
    const existing = pickSharedQuarterRecord(
      memberRec({ leaderDetail: { memberSelf: '3', managerScore: '', note: '', submissionStatus: 'rejected', submittedAt: T1, reviewedAt: T2, rejectedReason: '보완' } })
    );
    const stale = mergeQuarterPush(existing, submitted({ submittedAt: T1 }), 'member', { updatedAt: T3 });
    expect(stale.skipped).toContain('leaderDetail');
    const fresh = mergeQuarterPush(existing, submitted({ submittedAt: T3 }), 'member', { updatedAt: T3 });
    expect(fresh.record.leaderDetail.submissionStatus).toBe('submitted');
    expect(fresh.record.leaderDetail.rejectedReason).toBe('');
  });

  it('제출 취소(상태 빈 값)도 구성원이 반영할 수 있다', () => {
    const existing = pickSharedQuarterRecord(submitted());
    const cancelled = memberRec({
      leaderDetail: { memberSelf: '4', managerScore: '', note: '', submissionStatus: '', submittedAt: '', submittedBy: '' },
    });
    const { record } = mergeQuarterPush(existing, cancelled, 'member', { updatedAt: T2 });
    expect(record.leaderDetail.submissionStatus).toBe('');
  });
});

describe('분기 제출 공유 — push 병합(팀장)', () => {
  it('팀장 push 는 구성원 입력을 보존하고 검토·점수·확정을 반영한다', () => {
    const existing = pickSharedQuarterRecord(
      memberRec({ leaderDetail: { memberSelf: '4', managerScore: '', note: '자기평가', submissionStatus: 'submitted', submittedAt: T1, submittedBy: 'C' } })
    );
    const managerLocal = memberRec({
      leaderDetail: { memberSelf: '', managerScore: '5', note: '', submissionStatus: 'approved', submittedAt: T1, reviewedAt: T2, reviewedBy: 'manager' },
      quarter: { ...memberRec().quarter, leader: 4.6, locked: true, confirmedAt: T2 },
      execApproval: { approvedAt: T2 },
    });
    const { record } = mergeQuarterPush(existing, managerLocal, 'manager', { updatedAt: T3 });
    expect(record.leaderDetail.memberSelf).toBe('4');
    expect(record.leaderDetail.note).toBe('자기평가');
    expect(record.leaderDetail.managerScore).toBe('5');
    expect(record.leaderDetail.submissionStatus).toBe('approved');
    expect(record.quarter.locked).toBe(true);
    expect(record.execApproval).toEqual({ approvedAt: T2 });
  });

  it('팀장이 검토하는 사이 구성원이 재제출했다면 팀장 push 가 제출을 덮지 않는다', () => {
    const existing = pickSharedQuarterRecord(
      memberRec({ leaderDetail: { memberSelf: '4', managerScore: '', note: '', submissionStatus: 'submitted', submittedAt: T3, submittedBy: 'C' } })
    );
    const managerLocal = memberRec({
      leaderDetail: { memberSelf: '', managerScore: '', note: '', submissionStatus: 'rejected', submittedAt: T1, reviewedAt: T2, rejectedReason: '보완' },
    });
    const { record } = mergeQuarterPush(existing, managerLocal, 'manager', { updatedAt: T3 });
    expect(record.leaderDetail.submissionStatus).toBe('submitted');
  });

  it('공유본에 구성원 데이터가 없으면 팀장 로컬을 그대로 올린다', () => {
    const managerLocal = memberRec({
      dmDetail: { ...memberRec().dmDetail, lectureAvg: '4.5', lectureN: '10' },
    });
    const { record } = mergeQuarterPush(null, managerLocal, 'manager', { updatedAt: T3 });
    expect(record.dmDetail.lectureAvg).toBe('4.5');
  });
});

describe('분기 제출 공유 — snapshot upsert', () => {
  it('빈 레코드는 저장하지 않고 EMPTY_RECORD', () => {
    expect(() =>
      mergeMemberIntoQuarterCloudSnapshot(null, 'C', '2026-3Q', memberRec(), 'member')
    ).toThrow(/없습니다/);
  });

  it('잘못된 키는 거부', () => {
    expect(() => mergeMemberIntoQuarterCloudSnapshot(null, 'Z', '2026-3Q', memberRec(), 'member')).toThrow();
    expect(() => mergeMemberIntoQuarterCloudSnapshot(null, 'C', '2026-5Q', memberRec(), 'member')).toThrow();
  });

  it('upsert 후 정규화 round-trip', () => {
    const rec = memberRec({
      practiceDetail: { cases: [{ id: 'x', text: '사례' }], submissionStatus: 'submitted', submittedAt: T1 },
    });
    const { snapshot } = mergeMemberIntoQuarterCloudSnapshot(null, 'C', '2026-3Q', rec, 'member', { updatedAt: T2 });
    const again = normalizeQuarterCloudSnapshot(snapshot);
    expect(again.quarters['2026-3Q'].C.practiceDetail.cases).toHaveLength(1);
  });
});

describe('분기 제출 공유 — pull 병합', () => {
  const remote = {
    quarters: {
      '2026-3Q': {
        C: pickSharedQuarterRecord(
          memberRec({
            leaderDetail: { memberSelf: '4', managerScore: '', note: '', submissionStatus: 'submitted', submittedAt: T2, submittedBy: 'C' },
          })
        ),
      },
    },
  };

  it('팀장이 pull 하면 구성원 제출이 로컬에 들어오고 로컬 memos 는 유지된다', () => {
    const localStore = { quarters: { '2026-3Q': { C: { ...memberRec(), memos: [{ text: '내 메모' }] } } } };
    const { store, changedCount } = mergeQuartersIntoKpiStore(localStore, remote, 'manager');
    expect(changedCount).toBe(1);
    expect(store.quarters['2026-3Q'].C.leaderDetail.submissionStatus).toBe('submitted');
    expect(store.quarters['2026-3Q'].C.memos).toEqual([{ text: '내 메모' }]);
  });

  it('팀장 로컬에 레코드가 없어도 생성해서 반영한다', () => {
    const { store } = mergeQuartersIntoKpiStore({ quarters: {} }, remote, 'manager');
    expect(store.quarters['2026-3Q'].C.leaderDetail.memberSelf).toBe('4');
  });

  it('팀장 로컬의 managerScore·검토 결과는 구성원 제출이 덮지 않는다', () => {
    const local = memberRec({
      leaderDetail: { memberSelf: '', managerScore: '5', note: '', submissionStatus: 'approved', submittedAt: T2, reviewedAt: T3 },
    });
    const { store } = mergeQuartersIntoKpiStore({ quarters: { '2026-3Q': { C: local } } }, remote, 'manager');
    expect(store.quarters['2026-3Q'].C.leaderDetail.managerScore).toBe('5');
    expect(store.quarters['2026-3Q'].C.leaderDetail.submissionStatus).toBe('approved');
  });

  it('구성원이 pull 하면 팀장 검토 결과·확정 점수가 들어오고 내 입력은 유지', () => {
    const remoteReviewed = {
      quarters: {
        '2026-3Q': {
          C: pickSharedQuarterRecord(
            memberRec({
              leaderDetail: { memberSelf: '', managerScore: '5', note: '', submissionStatus: 'rejected', submittedAt: T1, reviewedAt: T3, rejectedReason: '보완' },
              quarter: { ...memberRec().quarter, locked: true, leader: 4.6, confirmedAt: T3 },
            })
          ),
        },
      },
    };
    const local = memberRec({
      leaderDetail: { memberSelf: '4', managerScore: '', note: '내 입력', submissionStatus: 'submitted', submittedAt: T1 },
    });
    const { store } = mergeQuartersIntoKpiStore({ quarters: { '2026-3Q': { C: local } } }, remoteReviewed, 'member');
    const rec = store.quarters['2026-3Q'].C;
    expect(rec.leaderDetail.note).toBe('내 입력');
    expect(rec.leaderDetail.memberSelf).toBe('4');
    expect(rec.leaderDetail.submissionStatus).toBe('rejected');
    expect(rec.leaderDetail.managerScore).toBe('5');
    expect(rec.quarter.locked).toBe(true);
  });
});

describe('분기 제출 공유 — 구성원 보충 저장 판정', () => {
  const local = memberRec({
    leaderDetail: { memberSelf: '4', managerScore: '', note: '', submissionStatus: 'submitted', submittedAt: T2, submittedBy: 'C' },
  });
  const remoteWith = (submittedAt) => ({
    quarters: {
      '2026-3Q': {
        C: pickSharedQuarterRecord(
          memberRec({ leaderDetail: { memberSelf: '4', managerScore: '', note: '', submissionStatus: 'submitted', submittedAt, submittedBy: 'C' } })
        ),
      },
    },
  });

  it('공유본에 내 레코드가 없으면 보충 저장', () => {
    expect(needsQuarterBackfillPush(local, { quarters: {} }, '2026-3Q', 'C')).toBe(true);
  });
  it('로컬 제출이 공유본보다 새로우면 보충 저장', () => {
    expect(needsQuarterBackfillPush(local, remoteWith(T1), '2026-3Q', 'C')).toBe(true);
  });
  it('이미 같은 제출이 공유돼 있으면 저장하지 않음', () => {
    expect(needsQuarterBackfillPush(local, remoteWith(T2), '2026-3Q', 'C')).toBe(false);
  });
  it('저장할 내용이 없으면 저장하지 않음', () => {
    expect(needsQuarterBackfillPush(memberRec(), { quarters: {} }, '2026-3Q', 'C')).toBe(false);
  });
});
