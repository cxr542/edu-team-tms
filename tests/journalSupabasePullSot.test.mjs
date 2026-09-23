import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('journal Supabase pull SoT flip (J7c)', () => {
  const apiSource = readFileSync(path.join(process.cwd(), 'api/journal-snapshots.js'), 'utf8');
  const clientSource = readFileSync(
    path.join(process.cwd(), 'src/utils/supabaseJournalSnapshot.js'),
    'utf8'
  );
  const hookSource = readFileSync(path.join(process.cwd(), 'src/hooks/useWeeklyJournal.js'), 'utf8');

  it('exposes team-read access and scope=team GET', () => {
    expect(apiSource).toContain('resolveJournalSnapshotsTeamReadAccess');
    expect(apiSource).toContain("scope === 'team'");
    expect(apiSource).toContain('memberCodeFromReferer');
    expect(apiSource).toContain("data: { rows }");
  });

  it('builds and fetches team snapshots on the client', () => {
    expect(clientSource).toContain('buildTeamJournalCloudSnapshotFromSupabaseRows');
    expect(clientSource).toContain('fetchTeamJournalSnapshotFromSupabase');
    expect(clientSource).toContain('scope=team');
  });

  it('uses Supabase-first pull with Blob fallback behind MANUAL_MIRROR', () => {
    expect(hookSource).toContain('fetchTeamJournalSnapshotFromSupabase');
    expect(hookSource).toContain('SUPABASE_MANUAL_MIRROR_ENABLED');
    expect(hookSource).toContain("source: 'supabase'");
    expect(hookSource).toContain('fetchJournalSnapshot()');
  });

  it('merges Supabase and Blob per member instead of unconditionally trusting Supabase (post-J8b-incident fix)', () => {
    expect(hookSource).toContain('mergeTeamSnapshotsPreferRicher');
    expect(hookSource).toContain("source: 'supabase+blob'");
    // Regression: both sources must be fetched when MANUAL_MIRROR is on, not just Supabase.
    expect(hookSource).toMatch(/Promise\.all\(\s*\[\s*fetchTeamJournalSnapshotFromSupabase\(\),\s*fetchJournalSnapshot\(\),/);
  });
});
