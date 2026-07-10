import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('JournalProvider team-share orchestration', () => {
  const providerSource = readFileSync(path.join(process.cwd(), 'src/context/JournalProvider.jsx'), 'utf8');
  const weeklyHookSource = readFileSync(path.join(process.cwd(), 'src/hooks/useWeeklyJournal.js'), 'utf8');
  const journalPageSource = readFileSync(
    path.join(process.cwd(), 'src/pages/WeeklyJournalPage.jsx'),
    'utf8'
  );

  it('returns the pulled snapshot so provider-level imports can sync approval state', () => {
    expect(weeklyHookSource).toContain('snapshot,');
    expect(weeklyHookSource).toContain('ownMemberCode,');
  });

  it('merges team-share pull kpiApproval while excluding preserved own-member state', () => {
    expect(providerSource).toContain('const pullFromCloud = useCallback(async (options) => {');
    expect(providerSource).toContain('ownMemberCode && !result.includeOwnMember');
    expect(providerSource).toContain('kpiApi.mergeJournalKpiApproval(result.snapshot, { excludeMemberCodes })');
    expect(providerSource).toMatch(/\.\.\.journal,[\s\S]*\.\.\.kpiApi,[\s\S]*pullFromCloud,/);
  });

  it('keeps admin/leader journal pull on the full-team path while preserving member choice UI', () => {
    expect(journalPageSource).toContain('showMemberTeamSharePull');
    expect(journalPageSource).toContain('includeOwnMember: true');
    expect(journalPageSource).toContain('includeOwnMember: false');
  });

  it('pulls Supabase-first when MANUAL_MIRROR is enabled (J7c)', () => {
    expect(weeklyHookSource).toContain('SUPABASE_MANUAL_MIRROR_ENABLED');
    expect(weeklyHookSource).toContain('fetchTeamJournalSnapshotFromSupabase');
    expect(weeklyHookSource).toContain("source: 'supabase'");
    expect(weeklyHookSource).toContain('fetchJournalSnapshot()');
    expect(journalPageSource).toContain("result.source === 'supabase'");
    expect(journalPageSource).toContain('Supabase (팀 공유 SoT)');
  });
});
