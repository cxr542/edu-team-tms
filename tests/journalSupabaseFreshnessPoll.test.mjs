import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JOURNAL_SUPABASE_FRESHNESS_POLL_MS } from '../src/constants/supabaseSync.js';

describe('journal Supabase freshness poll (J7a)', () => {
  const hookSource = readFileSync(
    path.join(process.cwd(), 'src/hooks/useJournalSupabaseFreshness.js'),
    'utf8'
  );
  const journalSource = readFileSync(
    path.join(process.cwd(), 'src/pages/WeeklyJournalPage.jsx'),
    'utf8'
  );
  const constantsSource = readFileSync(
    path.join(process.cwd(), 'src/constants/supabaseSync.js'),
    'utf8'
  );

  it('polls GET freshness on an interval and on window focus', () => {
    expect(JOURNAL_SUPABASE_FRESHNESS_POLL_MS).toBe(30000);
    expect(constantsSource).toContain('JOURNAL_SUPABASE_FRESHNESS_POLL_MS');
    expect(hookSource).toContain('getJournalSnapshotFromSupabase');
    expect(hookSource).toContain('setInterval');
    expect(hookSource).toContain("addEventListener('focus'");
    expect(hookSource).toContain('silent: true');
    expect(hookSource).toContain('buildJournalFreshnessState');
  });

  it('wires the poll hook on WeeklyJournalPage without auto-import', () => {
    expect(journalSource).toContain('useJournalSupabaseFreshness');
    expect(journalSource).toContain('enabled: showSupabaseMirrorTools');
    expect(journalSource).not.toMatch(/applyMemberFromSupabase\([^)]*poll/i);
    // Poll path must not call apply; pull remains explicit button only.
    expect(hookSource).not.toContain('applyMemberFromSupabase');
  });
});
