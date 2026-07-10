import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  JOURNAL_SUPABASE_AUTO_MIRROR_DEBOUNCE_MS,
  SUPABASE_MANUAL_MIRROR_ENABLED,
} from '../src/constants/supabaseSync.js';

describe('journal Supabase auto-mirror (J6)', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  const hookSource = readFileSync(path.join(process.cwd(), 'src/hooks/useWeeklyJournal.js'), 'utf8');
  const providerSource = readFileSync(
    path.join(process.cwd(), 'src/context/JournalProvider.jsx'),
    'utf8'
  );
  const journalSource = readFileSync(
    path.join(process.cwd(), 'src/pages/WeeklyJournalPage.jsx'),
    'utf8'
  );

  it('keeps Blob autoSyncCloud disabled while enabling gated Supabase auto-mirror', () => {
    expect(appSource).toContain('autoSyncCloud={false}');
    expect(appSource).not.toMatch(/autoSyncCloud=\{true\}/);
    expect(appSource).toContain('autoMirrorSupabase={autoMirrorSupabase}');
    expect(appSource).toContain('SUPABASE_MANUAL_MIRROR_ENABLED');
    expect(appSource).toContain('teamAccess.isLeader');
    expect(appSource).toContain('!teamAccess.isMemberScope');
  });

  it('queues dirty members on persist and debounces Supabase upsert', () => {
    expect(JOURNAL_SUPABASE_AUTO_MIRROR_DEBOUNCE_MS).toBe(8000);
    expect(hookSource).toContain('pendingSupabaseMembers');
    expect(hookSource).toContain('supabaseMirrorSaveStatus');
    expect(hookSource).toContain('JOURNAL_SUPABASE_AUTO_MIRROR_DEBOUNCE_MS');
    expect(hookSource).toContain('autoMirrorSupabase');
    expect(hookSource).toContain('mirrorFnRef.current');
  });

  it('builds KPI-enriched payload in JournalProvider mirror callback', () => {
    expect(providerSource).toContain('mirrorMemberToSupabase');
    expect(providerSource).toContain('buildMemberJournalSavePayload');
    expect(providerSource).toContain('saveJournalSnapshotToSupabase');
    expect(providerSource).toContain('autoMirrorSupabase');
  });

  it('surfaces auto-mirror status without toast spam copy', () => {
    expect(journalSource).toContain('SUPABASE_AUTO_MIRROR_STATUS_LABEL');
    expect(journalSource).toContain('supabaseAutoMirrorHint');
    expect(journalSource).toContain('Supabase 자동 미러');
    expect(typeof SUPABASE_MANUAL_MIRROR_ENABLED).toBe('boolean');
  });
});
