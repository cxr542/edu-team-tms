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
    expect(journalSource).toContain('Supabase와 Blob 저장소 비교');
    expect(journalSource).toContain('저장소 비교');
    expect(appShellSource).toContain('Supabase 오류');
  });

  it('does not expose the comparison tool to member-scoped journal shells', () => {
    expect(journalSource).toContain('showJournalLeaderToolbar = teamAccess.isLeader && !teamAccess.isMemberScope');
    expect(journalSource).toContain('showJournalBackupToolbar = showJournalLeaderToolbar');
    expect(journalSource).toContain('showSupabaseMirrorTools && (');
  });

  it('keeps leader mirror tools available while journal body is read-only on /admin', () => {
    expect(journalSource).toContain('관리자 조회 · 일지 본문 수정은 구성원 URL에서만 가능합니다');
    expect(journalSource).toContain('showJournalStatusPanel = !journalReadOnly || showJournalLeaderToolbar');
  });
});
