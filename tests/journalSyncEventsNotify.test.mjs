import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('journal sync_events notify (J7e)', () => {
  const apiSource = readFileSync(path.join(process.cwd(), 'api/journal-snapshots.js'), 'utf8');
  const freshnessSource = readFileSync(
    path.join(process.cwd(), 'src/utils/journalSupabaseFreshness.js'),
    'utf8'
  );
  const hookSource = readFileSync(
    path.join(process.cwd(), 'src/hooks/useJournalSupabaseFreshness.js'),
    'utf8'
  );
  const grantSource = readFileSync(
    path.join(process.cwd(), 'supabase/j7e-grant-service-role-sync-events.sql'),
    'utf8'
  );

  it('records best-effort sync_events on successful journal upsert', () => {
    expect(apiSource).toContain('recordJournalSyncEvent');
    expect(apiSource).toContain("source: JOURNAL_SYNC_EVENT_SOURCE");
    expect(apiSource).toContain("event_type: JOURNAL_SYNC_EVENT_TYPE");
    expect(apiSource).toContain("payload: updatedAt ? { updated_at: updatedAt } : {}");
    expect(apiSource).toContain('await recordJournalSyncEvent(client');
    expect(grantSource).toContain('grant insert on table public.sync_events to service_role');
  });

  it('surfaces 원격 갱신됨 via freshness poll without auto-merge', () => {
    expect(freshnessSource).toContain('원격 갱신됨 · 원격이 더 최신');
    expect(hookSource).toContain('remoteUpdateNotified');
    expect(hookSource).toContain('Does not auto-import remote into local');
    expect(hookSource).not.toContain('applyMemberFromSupabase');
  });
});
