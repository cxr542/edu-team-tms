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

  it('does not tell an auto-mirrored editor that auto sync is off (2026-09-23 incident)', () => {
    // The pre-J8 disclaimer must be gated behind showSupabaseAutoMirrorHint, not
    // rendered unconditionally — otherwise a member with auto-mirror ON still
    // reads "자동 클라우드 동기화는 꺼져 있으며" and thinks they must click
    // 「팀 공유 저장」 manually every time.
    expect(journalSource).toContain(
      '편집을 멈추면 잠시 후 자동으로 클라우드(Supabase)에도 저장됩니다.'
    );
    expect(journalSource).toMatch(
      /showSupabaseAutoMirrorHint \? \(\s*<>편집을 멈추면 잠시 후 자동으로 클라우드\(Supabase\)에도 저장됩니다\.<\/>\s*\) : \(\s*<>현재 자동 클라우드 동기화는 꺼져 있으며/
    );
  });
});
