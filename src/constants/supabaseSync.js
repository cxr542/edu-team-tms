/**
 * Journal / KPI manual Supabase mirror controls.
 * Keep false in production until Preview pilot (J3) succeeds.
 */
export const SUPABASE_MANUAL_MIRROR_ENABLED =
  String(import.meta.env.VITE_SUPABASE_MANUAL_MIRROR_ENABLED || '')
    .trim()
    .toLowerCase() === 'true';

export const SUPABASE_MANUAL_MIRROR_DISABLED_MESSAGE =
  'Supabase 수동 미러는 Preview 파일럿에서만 켭니다 (VITE_SUPABASE_MANUAL_MIRROR_ENABLED).';

/** J6: debounce after local persist before auto upsert to Supabase. */
export const JOURNAL_SUPABASE_AUTO_MIRROR_DEBOUNCE_MS = 8000;

/**
 * J7a: poll GET /api/journal-snapshots for freshness UI only (no auto-pull).
 * Matches announcements unread badge cadence.
 */
export const JOURNAL_SUPABASE_FRESHNESS_POLL_MS = 30000;
