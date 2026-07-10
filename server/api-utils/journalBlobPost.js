import { resolveJournalBlobPostEnabled } from '../../src/constants/journalBlobShare.js';

/**
 * Server-side J7d gate for POST /api/journal-snapshot.
 * Mirrors client resolveJournalBlobPostEnabled using process.env.
 */
export function isJournalBlobPostEnabled() {
  return resolveJournalBlobPostEnabled({
    explicitEnv:
      process.env.JOURNAL_BLOB_POST_ENABLED || process.env.VITE_JOURNAL_BLOB_POST_ENABLED || '',
    manualMirrorEnabled:
      String(process.env.VITE_SUPABASE_MANUAL_MIRROR_ENABLED || '')
        .trim()
        .toLowerCase() === 'true',
  });
}
