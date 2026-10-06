/**
 * 조회용 장부 — Supabase(ledger_*) 읽기 전용 경로 (anon SELECT).
 * 반환 모양은 /api/ledger-snapshot 과 동일해서 조회 화면 코드는 그대로 쓴다.
 * 쓰기는 하지 않는다. 쓰기 전환은 별도 단계(서버 API + service role).
 */
import { getSupabaseClient } from './supabaseClient';
import { buildEditDataFromRows, buildSnapshotFromRows } from './ledgerSnapshotMapping';

export {
  buildEditDataFromRows,
  buildSnapshotFromRows,
  categoryFromRow,
  transactionFromRow,
} from './ledgerSnapshotMapping';

/**
 * 어느 저장소에서 읽을지 결정한다. URL `?ledgerSource=supabase|blob` 이 환경변수보다 우선하므로
 * 플래그를 끈 채로도 배포 환경에서 미리 확인할 수 있고, 문제 시 `?ledgerSource=blob` 로 즉시 되돌려 볼 수 있다.
 * @param {{ envValue?: string|null, search?: string }} [options]
 */
export function resolveLedgerReadSource({ envValue = '', search = '' } = {}) {
  const fromUrl = new URLSearchParams(search).get('ledgerSource');
  if (fromUrl === 'supabase' || fromUrl === 'blob') return fromUrl;
  return String(envValue || '').trim().toLowerCase() === 'true' ? 'supabase' : 'blob';
}

export function getLedgerReadSource() {
  return resolveLedgerReadSource({
    envValue: import.meta.env?.VITE_LEDGER_SUPABASE_READ,
    search: typeof window === 'undefined' ? '' : window.location.search,
  });
}

async function selectAll(client, table, orderColumns) {
  let query = client.from(table).select('*');
  for (const col of orderColumns) query = query.order(col, { ascending: true });
  const { data, error } = await query.range(0, 4999);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

/** @returns {Promise<object|null>} 스냅샷, 또는 Supabase 미설정/빈 테이블이면 null */
export async function fetchLedgerSnapshotFromSupabase(client = getSupabaseClient()) {
  if (!client) return null;
  const [transactions, categories, settings] = await Promise.all([
    selectAll(client, 'ledger_transactions', ['tx_date', 'sort_order']),
    selectAll(client, 'ledger_categories', ['sort_order']),
    selectAll(client, 'ledger_settings', ['key']),
  ]);
  return buildSnapshotFromRows({ transactions, categories, settings });
}

/** 편집 화면(쓰기 경로)용 읽기: 거래마다 `_version`, 메뉴 설정 버전 포함. Supabase 미설정이면 null. */
export async function fetchLedgerEditDataFromSupabase(client = getSupabaseClient()) {
  if (!client) return null;
  const [transactions, categories, settings] = await Promise.all([
    selectAll(client, 'ledger_transactions', ['tx_date', 'sort_order']),
    selectAll(client, 'ledger_categories', ['sort_order']),
    selectAll(client, 'ledger_settings', ['key']),
  ]);
  return buildEditDataFromRows({ transactions, categories, settings });
}
