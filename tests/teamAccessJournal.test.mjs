import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('journal team access visibility', () => {
  const journalSource = readFileSync(
    path.join(process.cwd(), 'src/pages/WeeklyJournalPage.jsx'),
    'utf8'
  );
  const appShellSource = readFileSync(
    path.join(process.cwd(), 'src/components/AppShell.jsx'),
    'utf8'
  );

  it('keeps the storage comparison tool inside the leader-only mirror gate', () => {
    expect(journalSource).toContain(
      'showSupabaseMirrorTools = showJournalLeaderToolbar && SUPABASE_MANUAL_MIRROR_ENABLED'
    );
    expect(journalSource).toContain('showSupabaseMirrorTools && storageComparison');
    expect(journalSource).toContain('Blob과 Supabase 저장소 비교');
    expect(journalSource).toContain('저장소 비교');
    expect(appShellSource).toContain('Supabase 오류');
  });

  it('does not expose the comparison tool to member-scoped journal shells', () => {
    expect(journalSource).toContain('showJournalLeaderToolbar = teamAccess.isLeader && !teamAccess.isMemberScope');
    expect(journalSource).toContain('showJournalLeaderToolbar && !journalReadOnly');
  });
});
