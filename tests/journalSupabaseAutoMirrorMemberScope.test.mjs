import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('journal Supabase auto-mirror member scope (J8a)', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  const journalSource = readFileSync(
    path.join(process.cwd(), 'src/pages/WeeklyJournalPage.jsx'),
    'utf8'
  );

  it('extends the auto-mirror gate to member-scoped editors while keeping the J6 leader path', () => {
    expect(appSource).toContain('teamAccess.isLeader && !teamAccess.isMemberScope');
    expect(appSource).toContain('teamAccess.isMemberScope && Boolean(teamAccess.scopedMember)');
    // Regression: Blob autoSyncCloud must never be flipped on for member auto-mirror.
    expect(appSource).toContain('autoSyncCloud={false}');
    expect(appSource).not.toMatch(/autoSyncCloud=\{true\}/);
  });

  it('surfaces the auto-mirror status hint for a member editing their own tab, separate from the leader-only toolbar', () => {
    expect(journalSource).toContain('showSupabaseAutoMirrorHint');
    expect(journalSource).toContain('showSupabaseAutoMirrorHint && supabaseAutoMirrorHint');
    // The leader-only manual mirror toolbar stays a distinct flag (not widened by this change).
    expect(journalSource).toContain('showSupabaseMirrorTools = showJournalLeaderToolbar');
  });
});
