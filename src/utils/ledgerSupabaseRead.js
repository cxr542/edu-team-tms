/**
 * 장부 읽기 — Supabase(ledger_*) anon SELECT. 조회 화면(공개 스냅샷 모양)과 편집 화면(버전 포함)이 쓴다.
 * 쓰기는 하지 않는다. 쓰기는 서버 API(`/api/ledger-snapshot?resource=…`, service role)로만 한다.
 */
import { getSupabaseClient } from './supabaseClient';
import { buildEditDataFromRows, buildSnapshotFromRows } from './ledgerSnapshotMapping';

export {
  buildEditDataFromRows,
  buildSnapshotFromRows,
  categoryFromRow,
  transactionFromRow,
} from './ledgerSnapshotMapping';

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
