import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

const JOURNAL_SNAPSHOTS_TABLE = 'journal_snapshots';
const PAYLOAD_VERSION = 1;

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function hasMemberCode(memberCode) {
  return typeof memberCode === 'string' && memberCode.trim().length > 0;
}

function supabaseDisabledResult() {
  return result({
    ok: false,
    status: 'disabled',
    message: 'Supabase environment variables are not configured.',
  });
}

function unexpectedErrorResult(error, operation) {
  return result({
    ok: false,
    status: 'error',
    message:
      error instanceof Error ? error.message : `Unknown Supabase journal snapshot ${operation} error.`,
  });
}

export async function saveJournalSnapshotToSupabase({ memberCode, payload, updatedAt } = {}) {
  if (!hasMemberCode(memberCode)) {
    return result({ ok: false, status: 'error', message: 'memberCode is required.' });
  }

  if (payload == null) {
    return result({ ok: false, status: 'error', message: 'payload is required.' });
  }

  if (!isSupabaseConfigured) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    const { data, error } = await client
      .from(JOURNAL_SNAPSHOTS_TABLE)
      .upsert(
        {
          member_code: memberCode.trim(),
          payload,
          payload_version: PAYLOAD_VERSION,
          updated_at: updatedAt || new Date().toISOString(),
        },
        { onConflict: 'member_code' },
      )
      .select()
      .single();

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    return result({
      ok: true,
      status: 'ok',
      message: 'Journal snapshot saved to Supabase.',
      data,
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'save');
  }
}

export async function getJournalSnapshotFromSupabase(memberCode) {
  if (!hasMemberCode(memberCode)) {
    return result({ ok: false, status: 'error', message: 'memberCode is required.' });
  }

  if (!isSupabaseConfigured) return supabaseDisabledResult();

  const client = getSupabaseClient();
  if (!client) return supabaseDisabledResult();

  try {
    const { data, error } = await client
      .from(JOURNAL_SNAPSHOTS_TABLE)
      .select('member_code, payload, payload_version, updated_at')
      .eq('member_code', memberCode.trim())
      .maybeSingle();

    if (error) {
      return result({ ok: false, status: 'error', message: error.message });
    }

    if (!data) {
      return result({ ok: true, status: 'empty', message: 'Journal snapshot was not found.' });
    }

    return result({
      ok: true,
      status: 'ok',
      message: 'Journal snapshot loaded from Supabase.',
      data,
    });
  } catch (error) {
    return unexpectedErrorResult(error, 'read');
  }
}
