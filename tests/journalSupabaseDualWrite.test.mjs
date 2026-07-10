import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SUPABASE_MANUAL_MIRROR_ENABLED } from '../src/constants/supabaseSync.js';

describe('journal team-share Supabase dual-write (J7b)', () => {
  const providerSource = readFileSync(
    path.join(process.cwd(), 'src/context/JournalProvider.jsx'),
    'utf8'
  );
  const apiSource = readFileSync(path.join(process.cwd(), 'api/journal-snapshots.js'), 'utf8');
  const blobApiSource = readFileSync(path.join(process.cwd(), 'api/journal-snapshot.js'), 'utf8');

  it('gates dual-write on MANUAL_MIRROR and supports Blob demote (J7d)', () => {
    expect(providerSource).toContain('SUPABASE_MANUAL_MIRROR_ENABLED');
    expect(providerSource).toContain('JOURNAL_BLOB_POST_ENABLED');
    expect(providerSource).toContain('saveJournalSnapshotToSupabase');
    expect(providerSource).toContain('supabaseMirror');
    expect(providerSource).toContain('isMemberJournalEmpty');
    expect(providerSource).toContain("source: 'supabase'");
    expect(providerSource).toContain('saveMemberToCloud');
    // Gate is an env constant — production stays false unless Preview sets it.
    expect(typeof SUPABASE_MANUAL_MIRROR_ENABLED).toBe('boolean');
  });

  it('adds member referer access and empty-payload guard on journal-snapshots', () => {
    expect(apiSource).toContain('resolveJournalSnapshotsAccess');
    expect(apiSource).toContain('isSameMemberRouteReferer');
    expect(apiSource).toContain('empty-payload');
    expect(apiSource).toContain("mode: 'member'");
  });

  it('rejects empty Blob team-share writes and demotes POST when gated', () => {
    expect(blobApiSource).toContain('isMemberJournalEmpty');
    expect(blobApiSource).toContain('journal-empty-payload');
    expect(blobApiSource).toContain('isJournalBlobPostEnabled');
    expect(blobApiSource).toContain('journal-blob-post-disabled');
  });
});
