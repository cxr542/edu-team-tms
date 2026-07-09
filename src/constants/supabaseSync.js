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
