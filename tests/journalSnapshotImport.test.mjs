import { describe, expect, it, vi } from 'vitest';
import { mergeJournalSnapshotsByMember, mergeJournalSnapshotsViewOnlyImport } from '../src/utils/journalCloudSnapshot.js';
import {
  applyJournalSnapshotImport,
  applyJournalSnapshotViewOnlyImport,
  applySavedJournalMemberSnapshot,
  isJournalSnapshotImportable,
  JOURNAL_STORAGE_KEY,
  parseJournalSnapshotForImport,
  persistJournalStoreToLocalStorage,
} from '../src/utils/journalSnapshot.js';

const remoteBWeek = {
  '2026-06-08': {
    holiday: false,
    mm: { work: 1, improve: 0, leave: 0 },
    tasks: [{ id: 'b-mon', cat: 'other', title: 'B 월 업무', plan: 1, actual: 1, done: true }],
  },
  '2026-06-09': {
    holiday: false,
    mm: { work: 1, improve: 0, leave: 0 },
    tasks: [{ id: 'b-tue', cat: 'other', title: 'B 화 업무', plan: 1, actual: 1, done: true }],
  },
};

const remoteSnapshot = {
  version: 1,
  publishedAt: '2026-06-10T08:00:00.000Z',
  meta: {
    updatedAt: '2026-06-10T08:00:00.000Z',
    memberUpdatedAt: { B: '2026-06-10T08:00:00.000Z' },
  },
  memberJournals: {
    B: { days: remoteBWeek },
  },
};

describe('journal snapshot import', () => {
  it('imports memberJournals.B.days for 2026-06-08 from cloud snapshot', () => {
    const local = {
      memberJournals: {
        A: { days: { '2026-05-01': { holiday: false, mm: {}, tasks: [] } } },
        B: { days: {} },
        C: { days: {} },
      },
      meta: { updatedAt: '2026-06-11T00:00:00.000Z', memberUpdatedAt: { A: '2026-06-11T00:00:00.000Z' } },
    };

    const merged = applyJournalSnapshotImport(local, remoteSnapshot);

    expect(merged.memberJournals.B.days['2026-06-08'].tasks[0].title).toBe('B 월 업무');
    expect(merged.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B 화 업무');
  });

  it('adds missing B second-week data without deleting existing A-only days', () => {
    const local = {
      memberJournals: {
        A: {
          days: {
            '2026-05-12': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'a-only', cat: 'other', title: 'A only', plan: 1, actual: 1, done: true }],
            },
          },
        },
        B: {
          days: {
            '2026-05-01': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'b-old', cat: 'other', title: 'B old local', plan: 1, actual: 1, done: true }],
            },
          },
        },
        C: { days: {} },
      },
      meta: {
        updatedAt: '2026-06-11T12:00:00.000Z',
        memberUpdatedAt: {
          A: '2026-06-11T12:00:00.000Z',
          B: '2026-06-11T12:00:00.000Z',
        },
      },
    };

    const merged = applyJournalSnapshotImport(local, remoteSnapshot);

    expect(merged.memberJournals.A.days['2026-05-12'].tasks[0].title).toBe('A only');
    expect(merged.memberJournals.B.days['2026-05-01'].tasks[0].title).toBe('B old local');
    expect(merged.memberJournals.B.days['2026-06-08'].tasks[0].title).toBe('B 월 업무');
  });

  it('does not skip B when local B looks populated from demo copy with newer meta', () => {
    const local = {
      memberJournals: {
        A: { days: { '2026-05-01': { holiday: false, mm: {}, tasks: [] } } },
        B: {
          days: {
            '2026-05-01': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'demo', cat: 'other', title: 'demo copy', plan: 1, actual: 1, done: true }],
            },
          },
        },
        C: { days: {} },
      },
      meta: {
        updatedAt: '2026-06-11T12:00:00.000Z',
        memberUpdatedAt: { B: '2026-06-11T12:00:00.000Z' },
      },
    };

    const timestampMerged = mergeJournalSnapshotsByMember(local, remoteSnapshot);
    expect(timestampMerged.memberJournals.B.days['2026-06-08']).toBeUndefined();

    const imported = applyJournalSnapshotImport(local, remoteSnapshot);
    expect(imported.memberJournals.B.days['2026-06-08'].tasks[0].title).toBe('B 월 업무');
  });

  it('does not let global local updatedAt protect stale same-day member data on import', () => {
    const local = {
      memberJournals: {
        A: { days: { '2026-06-11': { holiday: false, mm: {}, tasks: [] } } },
        B: {
          days: {
            '2026-06-08': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'b-stale', cat: 'other', title: 'B stale local', plan: 1, actual: 1, done: true }],
            },
          },
        },
        C: { days: {} },
      },
      meta: {
        updatedAt: '2026-06-11T12:00:00.000Z',
        memberUpdatedAt: { A: '2026-06-11T12:00:00.000Z' },
      },
    };

    const imported = applyJournalSnapshotImport(local, remoteSnapshot);

    expect(imported.memberJournals.B.days['2026-06-08'].tasks[0].title).toBe('B 월 업무');
    expect(imported.meta.memberUpdatedAt.B).toBe('2026-06-10T08:00:00.000Z');
  });

  it('does not replace newer local member days with stale team-share import data', () => {
    const local = {
      memberJournals: {
        A: { days: {} },
        B: {
          days: {
            '2026-06-08': {
              holiday: false,
              mm: { work: 2, improve: 0, leave: 0 },
              tasks: [{ id: 'b-newer', cat: 'other', title: 'B newer local', plan: 2, actual: 2, done: true }],
            },
          },
        },
        C: { days: {} },
      },
      meta: {
        updatedAt: '2026-06-11T12:00:00.000Z',
        memberUpdatedAt: { B: '2026-06-11T12:00:00.000Z' },
      },
    };

    const staleTeamSnapshot = {
      ...remoteSnapshot,
      meta: {
        updatedAt: '2026-06-10T08:00:00.000Z',
        memberUpdatedAt: { B: '2026-06-10T08:00:00.000Z' },
      },
    };

    const imported = applyJournalSnapshotImport(local, staleTeamSnapshot);

    expect(imported.memberJournals.B.days['2026-06-08'].tasks[0].title).toBe('B newer local');
    expect(imported.memberJournals.B.days['2026-06-09'].tasks[0].title).toBe('B 화 업무');
    expect(imported.meta.memberUpdatedAt.B).toBe('2026-06-11T12:00:00.000Z');
  });

  it('rejects malformed snapshots safely', () => {
    expect(isJournalSnapshotImportable(null)).toBe(false);
    expect(isJournalSnapshotImportable({ version: 1 })).toBe(false);
    expect(() => parseJournalSnapshotForImport({ version: 1 })).toThrow(/형식/);
  });

  it('persists merged store to localStorage', () => {
    const storage = new Map();
    vi.stubGlobal('localStorage', {
      setItem: (key, value) => storage.set(key, value),
      getItem: (key) => storage.get(key) ?? null,
    });

    const merged = applyJournalSnapshotImport(
      { memberJournals: { A: { days: {} }, B: { days: {} }, C: { days: {} } }, meta: {} },
      remoteSnapshot
    );
    persistJournalStoreToLocalStorage(merged);

    const saved = JSON.parse(storage.get(JOURNAL_STORAGE_KEY));
    expect(saved.memberJournals.B.days['2026-06-08'].tasks[0].title).toBe('B 월 업무');

    vi.unstubAllGlobals();
  });

  it('does not change ledger snapshot merge helpers', async () => {
    const ledgerModule = await import('../src/utils/publishSnapshot.js');
    expect(typeof ledgerModule.fetchPublicSnapshot).toBe('function');
    expect(typeof ledgerModule.mergeJournalSnapshotsByMember).toBe('undefined');
  });

  it('view-only import merges other members but preserves own slice', () => {
    const local = {
      memberJournals: {
        A: { days: {} },
        B: {
          days: {
            '2026-06-01': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'b-own', cat: 'other', title: 'B 본인 작성', plan: 1, actual: 1, done: true }],
            },
          },
        },
        C: { days: {} },
      },
      meta: {
        updatedAt: '2026-06-11T12:00:00.000Z',
        memberUpdatedAt: { B: '2026-06-11T12:00:00.000Z' },
      },
    };

    const teamBackup = {
      version: 1,
      publishedAt: '2026-06-10T08:00:00.000Z',
      meta: {
        updatedAt: '2026-06-10T08:00:00.000Z',
        memberUpdatedAt: { A: '2026-06-10T08:00:00.000Z', B: '2026-06-10T08:00:00.000Z', C: '2026-06-10T08:00:00.000Z' },
      },
      memberJournals: {
        A: {
          days: {
            '2026-06-03': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'a-remote', cat: 'other', title: 'A 팀장 공유', plan: 1, actual: 1, done: true }],
            },
          },
        },
        B: {
          days: {
            '2026-06-08': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'b-remote', cat: 'other', title: 'B 백업본', plan: 1, actual: 1, done: true }],
            },
          },
        },
        C: {
          days: {
            '2026-06-04': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'c-remote', cat: 'other', title: 'C 팀장 공유', plan: 1, actual: 1, done: true }],
            },
          },
        },
      },
    };

    const merged = applyJournalSnapshotViewOnlyImport(local, teamBackup, 'B');

    expect(merged.memberJournals.B.days['2026-06-01'].tasks[0].title).toBe('B 본인 작성');
    expect(merged.memberJournals.B.days['2026-06-08']).toBeUndefined();
    expect(merged.memberJournals.A.days['2026-06-03'].tasks[0].title).toBe('A 팀장 공유');
    expect(merged.memberJournals.C.days['2026-06-04'].tasks[0].title).toBe('C 팀장 공유');
  });

  it('view-only import does not let global local updatedAt protect stale peer data', () => {
    const local = {
      memberJournals: {
        A: { days: { '2026-06-11': { holiday: false, mm: {}, tasks: [] } } },
        B: { days: {} },
        C: {
          days: {
            '2026-06-08': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'c-stale', cat: 'other', title: 'C stale local', plan: 1, actual: 1, done: true }],
            },
          },
        },
      },
      meta: {
        updatedAt: '2026-06-11T12:00:00.000Z',
        memberUpdatedAt: { A: '2026-06-11T12:00:00.000Z' },
      },
    };
    const teamBackup = {
      version: 1,
      publishedAt: '2026-06-10T08:00:00.000Z',
      meta: {
        updatedAt: '2026-06-10T08:00:00.000Z',
        memberUpdatedAt: { C: '2026-06-10T08:00:00.000Z' },
      },
      memberJournals: {
        C: {
          days: {
            '2026-06-08': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'c-remote', cat: 'other', title: 'C remote newer', plan: 1, actual: 1, done: true }],
            },
          },
        },
      },
    };

    const merged = applyJournalSnapshotViewOnlyImport(local, teamBackup, 'B');

    expect(merged.memberJournals.C.days['2026-06-08'].tasks[0].title).toBe('C remote newer');
    expect(merged.meta.memberUpdatedAt.C).toBe('2026-06-10T08:00:00.000Z');
  });

  it('saving one member keeps unrelated local member slices even if remote has newer copies', () => {
    const local = {
      memberJournals: {
        A: { days: {} },
        B: {
          days: {
            '2026-06-02': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'b-local', cat: 'other', title: 'B 저장 전', plan: 1, actual: 1, done: true }],
            },
          },
        },
        C: {
          days: {
            '2026-06-03': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'c-local', cat: 'other', title: 'C 로컬 작성', plan: 1, actual: 1, done: true }],
            },
          },
        },
      },
      meta: {
        updatedAt: '2026-06-11T09:00:00.000Z',
        memberUpdatedAt: {
          B: '2026-06-11T09:00:00.000Z',
          C: '2026-06-11T09:00:00.000Z',
        },
      },
    };
    const remoteAfterSavingB = {
      version: 1,
      publishedAt: '2026-06-11T10:00:00.000Z',
      meta: {
        updatedAt: '2026-06-11T10:00:00.000Z',
        memberUpdatedAt: {
          B: '2026-06-11T10:00:00.000Z',
          C: '2026-06-11T10:00:00.000Z',
        },
      },
      memberJournals: {
        B: {
          days: {
            '2026-06-02': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'b-saved', cat: 'other', title: 'B 공유 저장됨', plan: 1, actual: 1, done: true }],
            },
          },
        },
        C: {
          days: {
            '2026-06-04': {
              holiday: false,
              mm: { work: 1, improve: 0, leave: 0 },
              tasks: [{ id: 'c-remote', cat: 'other', title: 'C 원격 최신', plan: 1, actual: 1, done: true }],
            },
          },
        },
      },
    };

    const merged = applySavedJournalMemberSnapshot(local, remoteAfterSavingB, 'B');

    expect(merged.memberJournals.B.days['2026-06-02'].tasks[0].title).toBe('B 공유 저장됨');
    expect(merged.memberJournals.C.days['2026-06-03'].tasks[0].title).toBe('C 로컬 작성');
    expect(merged.memberJournals.C.days['2026-06-04']).toBeUndefined();
  });

  it('mergeJournalSnapshotsViewOnlyImport rejects invalid member code', () => {
    expect(() =>
      mergeJournalSnapshotsViewOnlyImport({ memberJournals: {} }, remoteSnapshot, 'X')
    ).toThrow(/구성원 코드/);
  });
});
