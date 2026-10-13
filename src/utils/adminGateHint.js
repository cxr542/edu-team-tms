/**
 * 관리자 로그인 화면 비밀번호 힌트. ledger_settings(key=admin_gate_hint)에 저장한다.
 * 읽기: anon SELECT(로그인 전 공개). 쓰기: 관리자 세션이 필요한 /api/ledger-snapshot?resource=settings.
 */
import { getSupabaseClient } from './supabaseClient';
import { createLedgerApi } from './ledgerApiClient';

export const ADMIN_GATE_HINT_KEY = 'admin_gate_hint';
export const ADMIN_GATE_HINT_MAX_LENGTH = 80;

async function readRow(client = getSupabaseClient()) {
  if (!client) return null;
  const { data, error } = await client
    .from('ledger_settings')
    .select('value, version')
    .eq('key', ADMIN_GATE_HINT_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** @returns {Promise<string>} 저장된 힌트. 없거나 읽기 실패면 빈 문자열(조용히 숨김). */
export async function fetchAdminGateHint() {
  try {
    const row = await readRow();
    return typeof row?.value?.hint === 'string' ? row.value.hint : '';
  } catch {
    return '';
  }
}

/** 빈 문자열을 저장하면 힌트가 사라진다. */
export async function saveAdminGateHint(hint, api = createLedgerApi()) {
  const row = await readRow();
  await api.putSetting(ADMIN_GATE_HINT_KEY, { hint: String(hint || '').trim() }, row?.version ?? null);
}
