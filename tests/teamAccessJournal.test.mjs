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
    expect(journalSource).toContain(
      '관리자 조회 · 항목을 클릭하면 세부 내용을 볼 수 있습니다. 수정은 구성원 URL에서만'
    );
    expect(journalSource).toContain('showJournalStatusPanel = !journalReadOnly || showJournalLeaderToolbar');
  });

  it('allows admins to open task detail panel in read-only view', () => {
    expect(journalSource).toContain("title={journalReadOnly ? '클릭하여 세부 내용 조회' : undefined}");
    expect(journalSource).toContain("journalReadOnly ? '업무 항목 조회' : '업무 항목 편집'");
    // task click always opens the panel; save/delete stay gated by journalReadOnly
    expect(journalSource).toMatch(/onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*openEdit\(t\.id, key\);/);
  });
});
