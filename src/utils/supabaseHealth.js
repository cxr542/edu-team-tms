import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export const SUPABASE_HEALTH_STATUS = Object.freeze({
  DISABLED: 'disabled',
  OK: 'ok',
  ERROR: 'error',
});

export async function checkSupabaseHealth() {
  if (!isSupabaseConfigured) {
    return {
      status: SUPABASE_HEALTH_STATUS.DISABLED,
      ok: false,
      message: 'Supabase environment variables are not configured.',
    };
  }

  const client = getSupabaseClient();

  if (!client) {
    return {
      status: SUPABASE_HEALTH_STATUS.DISABLED,
      ok: false,
      message: 'Supabase client is not available.',
    };
  }

  try {
    const { error } = await client
      .from('sync_events')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      return {
        status: SUPABASE_HEALTH_STATUS.ERROR,
        ok: false,
        message: error.message,
      };
    }

    return {
      status: SUPABASE_HEALTH_STATUS.OK,
      ok: true,
      message: 'Supabase connection is healthy.',
    };
  } catch (error) {
    return {
      status: SUPABASE_HEALTH_STATUS.ERROR,
      ok: false,
      message: error instanceof Error ? error.message : 'Unknown Supabase health check error.',
    };
  }
}
