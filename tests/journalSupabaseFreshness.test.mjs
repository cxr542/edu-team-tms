import { describe, expect, it } from 'vitest';
import {
  JOURNAL_FRESHNESS_STATUS,
  buildJournalFreshnessState,
  classifyJournalFreshness,
  formatJournalFreshnessLabel,
  resolveLocalMemberUpdatedAt,
  resolveRemoteSnapshotUpdatedAt,
} from '../src/utils/journalSupabaseFreshness.js';
import { isRemoteNewer } from '../src/utils/journalSnapshot.js';

describe('journalSupabaseFreshness', () => {
  it('resolves per-member local updatedAt without borrowing another member update', () => {
    expect(
      resolveLocalMemberUpdatedAt(
        { updatedAt: '2026-07-01T00:00:00.000Z', memberUpdatedAt: { A: '2026-07-09T00:00:00.000Z' } },
        'A'
      )
    ).toBe('2026-07-09T00:00:00.000Z');
    expect(
      resolveLocalMemberUpdatedAt({ updatedAt: '2026-07-01T00:00:00.000Z', memberUpdatedAt: {} }, 'B')
    ).toBe(null);
    expect(resolveLocalMemberUpdatedAt({ updatedAt: '2026-07-01T00:00:00.000Z' }, '')).toBe(
      '2026-07-01T00:00:00.000Z'
    );
    expect(resolveLocalMemberUpdatedAt(null, 'A')).toBe(null);
  });

  it('resolves remote updated_at from API data', () => {
    expect(resolveRemoteSnapshotUpdatedAt({ updated_at: '2026-07-09T01:00:00.000Z' })).toBe(
      '2026-07-09T01:00:00.000Z'
    );
    expect(resolveRemoteSnapshotUpdatedAt(null)).toBe(null);
  });

  it('classifies remote-newer / local-newer / equal / empty', () => {
    expect(
      classifyJournalFreshness({
        localUpdatedAt: '2026-07-09T00:00:00.000Z',
        remoteUpdatedAt: '2026-07-09T01:00:00.000Z',
      })
    ).toBe(JOURNAL_FRESHNESS_STATUS.remoteNewer);

    expect(
      classifyJournalFreshness({
        localUpdatedAt: '2026-07-09T02:00:00.000Z',
        remoteUpdatedAt: '2026-07-09T01:00:00.000Z',
      })
    ).toBe(JOURNAL_FRESHNESS_STATUS.localNewer);

    expect(
      classifyJournalFreshness({
        localUpdatedAt: '2026-07-09T01:00:00.000Z',
        remoteUpdatedAt: '2026-07-09T01:00:00.000Z',
      })
    ).toBe(JOURNAL_FRESHNESS_STATUS.equal);

    expect(
      classifyJournalFreshness({
        localUpdatedAt: '2026-07-09T01:00:00.000Z',
        remoteUpdatedAt: null,
      })
    ).toBe(JOURNAL_FRESHNESS_STATUS.empty);

    expect(
      classifyJournalFreshness({
        localUpdatedAt: null,
        remoteUpdatedAt: '2026-07-09T01:00:00.000Z',
      })
    ).toBe(JOURNAL_FRESHNESS_STATUS.remoteNewer);
  });

  it('aligns remote-newer with isRemoteNewer helper', () => {
    const remote = '2026-07-09T12:00:00.000Z';
    const local = '2026-07-09T11:00:00.000Z';
    expect(isRemoteNewer(remote, local)).toBe(true);
    expect(classifyJournalFreshness({ localUpdatedAt: local, remoteUpdatedAt: remote })).toBe(
      JOURNAL_FRESHNESS_STATUS.remoteNewer
    );
  });

  it('formats the J4/J7e acceptance label', () => {
    expect(formatJournalFreshnessLabel(JOURNAL_FRESHNESS_STATUS.remoteNewer)).toBe(
      '원격 갱신됨 · 원격이 더 최신'
    );
    expect(formatJournalFreshnessLabel(JOURNAL_FRESHNESS_STATUS.remoteNewer)).toContain('원격이 더 최신');
    expect(formatJournalFreshnessLabel(JOURNAL_FRESHNESS_STATUS.remoteNewer)).toContain('원격 갱신됨');
  });

  it('builds freshness state from API result without pulling', () => {
    expect(
      buildJournalFreshnessState(
        { ok: true, status: 'ok', data: { updated_at: '2026-07-09T01:00:00.000Z' } },
        '2026-07-09T00:00:00.000Z'
      )
    ).toEqual({
      status: JOURNAL_FRESHNESS_STATUS.remoteNewer,
      remoteUpdatedAt: '2026-07-09T01:00:00.000Z',
      message: '',
    });

    expect(buildJournalFreshnessState({ ok: true, status: 'empty', data: null }, null)).toEqual({
      status: JOURNAL_FRESHNESS_STATUS.empty,
      remoteUpdatedAt: null,
      message: '',
    });

    expect(
      buildJournalFreshnessState(
        { ok: false, status: 'disabled', message: 'off' },
        '2026-07-09T00:00:00.000Z'
      )
    ).toEqual({
      status: JOURNAL_FRESHNESS_STATUS.disabled,
      remoteUpdatedAt: null,
      message: 'off',
    });
  });
});
