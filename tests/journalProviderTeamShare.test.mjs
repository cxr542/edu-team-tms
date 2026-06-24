import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('JournalProvider team-share orchestration', () => {
  const providerSource = readFileSync(path.join(process.cwd(), 'src/context/JournalProvider.jsx'), 'utf8');
  const weeklyHookSource = readFileSync(path.join(process.cwd(), 'src/hooks/useWeeklyJournal.js'), 'utf8');

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
});
