/**
 * 조회용 장부 — Supabase(ledger_*) 읽기 전용 경로 (anon SELECT).
 * 반환 모양은 /api/ledger-snapshot 과 동일해서 조회 화면 코드는 그대로 쓴다.
 * 쓰기는 하지 않는다. 쓰기 전환은 별도 단계(서버 API + service role).
 */
import { getSupabaseClient } from './supabaseClient';

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

function dropNullish(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

export function transactionFromRow(row) {
  const extra = row.extra_data && typeof row.extra_data === 'object' ? row.extra_data : {};
  return dropNullish({
    id: row.id,
    date: row.tx_date,
    category: row.category,
    description: row.description,
    amount: row.amount,
    balance: row.balance,
    paymentMethod: row.payment_method,
    attendees: row.attendees,
    extraData: Object.keys(extra).length ? extra : undefined,
  });
}

export function categoryFromRow(row) {
  return dropNullish({
    id: row.id,
    label: row.label,
    color: row.color,
    description: row.description,
    matchKeywords: Array.isArray(row.match_keywords) ? row.match_keywords : [],
  });
}

/**
 * ledger_* 행 → 공개 스냅샷 모양. 거래가 하나도 없으면 null (Blob 경로로 되돌리기 위함).
 * publishedAt 은 세 테이블 중 가장 늦은 updated_at.
 */
export function buildSnapshotFromRows({ transactions = [], categories = [], settings = [] }) {
  if (!transactions.length) return null;
  const stamps = [...transactions, ...categories, ...settings]
    .map((r) => Date.parse(r.updated_at))
    .filter(Number.isFinite);
  const menu = settings.find((s) => s.key === 'viewer_menu_visibility')?.value;
  return {
    publishedAt: new Date(stamps.length ? Math.max(...stamps) : Date.now()).toISOString(),
    categories: categories.map(categoryFromRow),
    transactions: transactions.map(transactionFromRow),
    viewerMenuVisibility: menu && typeof menu === 'object' ? menu : undefined,
  };
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
    selectAll(client, 'ledger_transactions', ['sort_order']),
    selectAll(client, 'ledger_categories', ['sort_order']),
    selectAll(client, 'ledger_settings', ['key']),
  ]);
  return buildSnapshotFromRows({ transactions, categories, settings });
}
