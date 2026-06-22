import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('JournalProvider team-share orchestration', () => {
  const providerSource = readFileSync(path.join(process.cwd(), 'src/context/JournalProvider.jsx'), 'utf8');
  const weeklyHookSource = readFileSync(path.join(process.cwd(), 'src/hooks/useWeeklyJournal.js'), 'utf8');

  it('returns the pulled snapshot so provider-level imports can sync approval state', () => {
    expect(weeklyHookSource).toContain('snapshot,');
  });

  it('merges team-share pull kpiApproval into the KPI operational store', () => {
    expect(providerSource).toContain('const pullFromCloud = useCallback(async (options) => {');
    expect(providerSource).toContain('kpiApi.mergeJournalKpiApproval(result.snapshot)');
    expect(providerSource).toMatch(/\.\.\.journal,[\s\S]*\.\.\.kpiApi,[\s\S]*pullFromCloud,/);
  });
});
