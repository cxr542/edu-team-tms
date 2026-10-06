/**
 * Pure helpers for the ledger Blob/localStorage snapshot → Supabase migration.
 * No I/O here so the mapping and classification can be unit-tested.
 */

export const VIEWER_MENU_SETTING_KEY = 'viewer_menu_visibility';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function emptyToNull(v) {
  return v === undefined || v === null || v === '' ? null : v;
}

/** snapshot transaction → ledger_transactions row (no version/created_at/updated_at) */
export function toTransactionRow(tx, index) {
  const extra = tx.extraData && typeof tx.extraData === 'object' && !Array.isArray(tx.extraData) ? tx.extraData : {};
  return {
    id: String(tx.id),
    tx_date: tx.date,
    category: tx.category,
    description: tx.description ?? '',
    amount: tx.amount,
    balance: tx.balance,
    payment_method: emptyToNull(tx.paymentMethod),
    attendees: emptyToNull(tx.attendees),
    extra_data: extra,
    sort_order: index,
  };
}

export function toCategoryRow(cat, index) {
  return {
    id: String(cat.id),
    label: cat.label,
    color: emptyToNull(cat.color),
    description: emptyToNull(cat.description),
    match_keywords: Array.isArray(cat.matchKeywords) ? cat.matchKeywords : [],
    sort_order: index,
  };
}

export function toSettingRows(snapshot) {
  const menu = snapshot.viewerMenuVisibility;
  if (!menu || typeof menu !== 'object') return [];
  return [{ key: VIEWER_MENU_SETTING_KEY, value: menu }];
}

/** Returns problems that must block the migration. */
export function validateSnapshot(snapshot) {
  const problems = [];
  const txs = snapshot?.transactions;
  if (!Array.isArray(txs)) return ['transactions 배열이 없습니다.'];
  const seen = new Set();
  txs.forEach((tx, i) => {
    const where = `transactions[${i}] (${tx?.id})`;
    if (!tx?.id) problems.push(`${where}: id 없음`);
    else if (seen.has(tx.id)) problems.push(`${where}: id 중복`);
    else seen.add(tx.id);
    if (!DATE_RE.test(tx?.date ?? '')) problems.push(`${where}: date 형식 오류 (${tx?.date})`);
    if (!Number.isInteger(tx?.amount)) problems.push(`${where}: amount가 정수가 아님 (${tx?.amount})`);
    if (!Number.isInteger(tx?.balance)) problems.push(`${where}: balance가 정수가 아님 (${tx?.balance})`);
    if (!tx?.category) problems.push(`${where}: category 없음`);
  });
  (snapshot.categories ?? []).forEach((c, i) => {
    if (!c?.id || !c?.label) problems.push(`categories[${i}]: id/label 없음`);
  });
  return problems;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Compare only the migrated fields (ignores version/created_at/updated_at). */
export function rowsEqual(a, b, keys) {
  return keys.every((k) => stable(a[k]) === stable(b[k]));
}

/**
 * @returns {{ add: object[], update: object[], skip: object[] }}
 * `existing` is an array of rows already in the table (or [] when empty).
 */
export function classifyRows(desired, existing, pk, keys) {
  const byKey = new Map(existing.map((r) => [r[pk], r]));
  const out = { add: [], update: [], skip: [] };
  for (const row of desired) {
    const cur = byKey.get(row[pk]);
    if (!cur) out.add.push(row);
    else if (rowsEqual(row, cur, keys)) out.skip.push(row);
    else out.update.push(row);
  }
  return out;
}

export const TX_KEYS = [
  'tx_date',
  'category',
  'description',
  'amount',
  'balance',
  'payment_method',
  'attendees',
  'extra_data',
  'sort_order',
];
export const CAT_KEYS = ['label', 'color', 'description', 'match_keywords', 'sort_order'];
export const SETTING_KEYS = ['value'];

/** Reference figures used to reconcile Supabase against the snapshot (step 4). */
export function summarize(rows) {
  const months = {};
  for (const r of rows) {
    const m = String(r.tx_date).slice(0, 7);
    months[m] ??= { count: 0, sum: 0, lastBalance: null };
    months[m].count += 1;
    months[m].sum += r.amount;
    months[m].lastBalance = r.balance;
  }
  return { total: rows.length, months };
}
