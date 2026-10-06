/**
 * 장부 행 단위 쓰기 (Supabase ledger_* , service role 클라이언트 주입).
 *
 * - 충돌 감지: 수정/삭제는 expectedVersion 이 DB version 과 같을 때만 적용 (불일치 → 409 version-conflict).
 * - 잔액(balance)은 "월 예산 − 누적 지출"의 파생값이라, 쓰기 후 영향받은 달을 서버가 다시 계산한다.
 *   (supabase/ledger-write-support.sql 의 트리거는 잔액만 바뀐 행의 version 을 올리지 않는다.)
 * - HTTP/인증은 여기서 다루지 않는다. 호출자(api/ledger-snapshot.js)가 관리자 검증을 끝낸 뒤 부른다.
 */
import { calculateBalances } from '../../src/utils/ledgerBalances.js';

const TX_TABLE = 'ledger_transactions';
const CAT_TABLE = 'ledger_categories';
const SETTINGS_TABLE = 'ledger_settings';
const TX_COLUMNS =
  'id, tx_date, category, description, amount, balance, payment_method, attendees, extra_data, sort_order, version';
const MAX_BULK = 1000;
const MAX_EXTRA_BYTES = 10 * 1024;
const SETTING_KEYS = new Set(['viewer_menu_visibility']);

export class LedgerApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function fail(status, code, message, extra) {
  throw new LedgerApiError(status, code, message, extra);
}

function unwrap({ data, error }, what) {
  if (error) {
    if (error.code === '23505') fail(409, 'duplicate-id', `${what}: 이미 같은 id가 있습니다.`);
    fail(500, 'db-error', `${what}: ${error.message}`);
  }
  return data;
}

// ── 입력 검증 ───────────────────────────────────────────────────────────

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function text(value, field, max, { required = false } = {}) {
  const s = value === undefined || value === null ? '' : String(value);
  if (required && !s.trim()) fail(400, 'invalid-input', `${field} 값이 필요합니다.`);
  if (s.length > max) fail(400, 'invalid-input', `${field} 은(는) ${max}자 이하여야 합니다.`);
  return s;
}

/** 클라이언트 거래 객체 → DB 행(잔액·정렬·버전 제외). 잘못된 입력은 400. */
export function normalizeTransactionInput(raw, { generateId = true } = {}) {
  if (!raw || typeof raw !== 'object') fail(400, 'invalid-input', '거래 데이터가 필요합니다.');
  let id = raw.id === undefined || raw.id === null ? '' : String(raw.id).trim();
  if (!id && generateId) id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id)) fail(400, 'invalid-input', 'id 형식이 올바르지 않습니다.');
  if (!isValidDate(raw.date)) fail(400, 'invalid-input', `date 는 YYYY-MM-DD 형식이어야 합니다. (${raw.date})`);
  if (!Number.isInteger(raw.amount) || Math.abs(raw.amount) > 1_000_000_000) {
    fail(400, 'invalid-input', 'amount 는 정수(원)여야 합니다.');
  }
  const extra = raw.extraData ?? {};
  if (typeof extra !== 'object' || Array.isArray(extra)) fail(400, 'invalid-input', 'extraData 는 객체여야 합니다.');
  if (JSON.stringify(extra).length > MAX_EXTRA_BYTES) fail(400, 'invalid-input', 'extraData 가 너무 큽니다.');
  return {
    id,
    tx_date: raw.date,
    category: text(raw.category, 'category', 60, { required: true }),
    description: text(raw.description, 'description', 500),
    amount: raw.amount,
    payment_method: text(raw.paymentMethod, 'paymentMethod', 100) || null,
    attendees: text(raw.attendees, 'attendees', 300) || null,
    extra_data: extra,
  };
}

function normalizeCategoryInput(raw, index) {
  if (!raw || typeof raw !== 'object') fail(400, 'invalid-input', '카테고리 데이터가 필요합니다.');
  const id = text(raw.id, 'category.id', 60, { required: true }).trim();
  return {
    id,
    label: text(raw.label, 'category.label', 60, { required: true }),
    color: text(raw.color, 'category.color', 30) || null,
    description: text(raw.description, 'category.description', 300) || null,
    match_keywords: Array.isArray(raw.matchKeywords) ? raw.matchKeywords.map((k) => text(k, 'matchKeyword', 60)) : [],
    sort_order: index,
  };
}

// ── 잔액 재계산 ─────────────────────────────────────────────────────────

function monthRange(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return [`${yyyymm}-01`, `${next}-01`];
}

/** 한 달의 잔액을 (날짜, sort_order) 순으로 다시 계산해, 값이 달라진 행만 갱신. */
export async function rebalanceMonth(client, yyyymm) {
  const [from, to] = monthRange(yyyymm);
  const rows = unwrap(
    await client
      .from(TX_TABLE)
      .select('id, tx_date, amount, balance, sort_order')
      .gte('tx_date', from)
      .lt('tx_date', to)
      .order('tx_date', { ascending: true })
      .order('sort_order', { ascending: true }),
    'rebalance read'
  );
  const computed = calculateBalances((rows || []).map((r) => ({ id: r.id, date: r.tx_date, amount: r.amount })));
  const current = new Map((rows || []).map((r) => [r.id, r.balance]));
  let changed = 0;
  for (const tx of computed) {
    if (current.get(tx.id) === tx.balance) continue;
    unwrap(await client.from(TX_TABLE).update({ balance: tx.balance }).eq('id', tx.id).select('id'), 'rebalance write');
    changed += 1;
  }
  return changed;
}

async function rebalanceMonths(client, months) {
  for (const m of [...new Set(months)].filter(Boolean).sort()) await rebalanceMonth(client, m);
}

const monthOf = (date) => String(date).slice(0, 7);

async function nextSortOrder(client) {
  const rows = unwrap(
    await client.from(TX_TABLE).select('sort_order').order('sort_order', { ascending: false }).limit(1),
    'sort_order read'
  );
  return (rows?.[0]?.sort_order ?? -1) + 1;
}

async function fetchTransaction(client, id) {
  const rows = unwrap(await client.from(TX_TABLE).select(TX_COLUMNS).eq('id', id), 'transaction read');
  return rows?.[0] ?? null;
}

// ── 행 단위 쓰기 ────────────────────────────────────────────────────────

export async function insertTransaction(client, raw) {
  const row = normalizeTransactionInput(raw);
  const sortOrder = await nextSortOrder(client);
  unwrap(await client.from(TX_TABLE).insert({ ...row, balance: 0, sort_order: sortOrder }).select('id'), 'insert');
  await rebalanceMonth(client, monthOf(row.tx_date));
  return fetchTransaction(client, row.id);
}

function requireExpectedVersion(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) fail(400, 'invalid-input', 'expectedVersion(정수)이 필요합니다.');
  return n;
}

async function failMissingOrConflict(client, id) {
  const cur = await fetchTransaction(client, id);
  if (!cur) fail(404, 'not-found', '거래를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
  fail(409, 'version-conflict', '다른 곳에서 먼저 수정되었습니다. 새로고침 후 다시 시도하세요.', {
    currentVersion: cur.version,
  });
}

export async function updateTransaction(client, id, raw, expectedVersion) {
  const version = requireExpectedVersion(expectedVersion);
  const before = await fetchTransaction(client, id);
  const { id: _ignored, ...patch } = normalizeTransactionInput({ ...raw, id });
  const updated = unwrap(
    await client.from(TX_TABLE).update(patch).eq('id', id).eq('version', version).select('id'),
    'update'
  );
  if (!updated?.length) await failMissingOrConflict(client, id);
  await rebalanceMonths(client, [monthOf(patch.tx_date), before ? monthOf(before.tx_date) : null]);
  return fetchTransaction(client, id);
}

export async function deleteTransaction(client, id, expectedVersion) {
  const version = requireExpectedVersion(expectedVersion);
  const before = await fetchTransaction(client, id);
  const deleted = unwrap(
    await client.from(TX_TABLE).delete().eq('id', id).eq('version', version).select('id'),
    'delete'
  );
  if (!deleted?.length) await failMissingOrConflict(client, id);
  if (before) await rebalanceMonth(client, monthOf(before.tx_date));
  return { id };
}

/**
 * 일괄 반영(JSON 가져오기·엑셀·카드 알림 여러 건).
 * merge  : 같은 id 는 덮어쓰고 새 id 는 추가. 목록에 없는 기존 행은 그대로 둔다.
 * replace: 위에 더해 목록에 없는 기존 행을 삭제. confirmReplace === true 가 필요하다.
 */
export async function bulkUpsertTransactions(client, rawList, { mode = 'merge', confirmReplace = false } = {}) {
  if (!Array.isArray(rawList) || !rawList.length) fail(400, 'invalid-input', 'transactions 배열이 필요합니다.');
  if (rawList.length > MAX_BULK) fail(400, 'invalid-input', `한 번에 ${MAX_BULK}건까지만 반영할 수 있습니다.`);
  if (mode !== 'merge' && mode !== 'replace') fail(400, 'invalid-input', 'mode 는 merge 또는 replace 입니다.');
  if (mode === 'replace' && confirmReplace !== true) {
    fail(400, 'confirm-required', 'replace 는 confirmReplace: true 가 필요합니다.');
  }

  const rows = rawList.map((r) => normalizeTransactionInput(r));
  const ids = new Set();
  for (const r of rows) {
    if (ids.has(r.id)) fail(400, 'invalid-input', `id 중복: ${r.id}`);
    ids.add(r.id);
  }

  const existing = unwrap(await client.from(TX_TABLE).select('id, tx_date').limit(5000), 'bulk read') || [];
  const existingIds = new Set(existing.map((e) => e.id));
  const months = new Set(rows.map((r) => monthOf(r.tx_date)));

  let removed = 0;
  if (mode === 'replace') {
    const doomed = existing.filter((e) => !ids.has(e.id));
    if (doomed.length) {
      unwrap(await client.from(TX_TABLE).delete().in('id', doomed.map((d) => d.id)).select('id'), 'bulk delete');
      doomed.forEach((d) => months.add(monthOf(d.tx_date)));
      removed = doomed.length;
    }
  }

  let nextOrder = await nextSortOrder(client);
  const payload = rows.map((r, i) => ({
    ...r,
    balance: 0,
    // replace: 입력 순서가 곧 순서. merge: 기존 행은 순서를 건드리지 않고 새 행만 뒤에 붙인다.
    ...(mode === 'replace' ? { sort_order: i } : existingIds.has(r.id) ? {} : { sort_order: nextOrder++ }),
  }));
  const toInsert = payload.filter((p) => !existingIds.has(p.id));
  const toUpdate = payload.filter((p) => existingIds.has(p.id));
  if (toInsert.length) unwrap(await client.from(TX_TABLE).insert(toInsert).select('id'), 'bulk insert');
  for (const p of toUpdate) {
    const { id, balance: _b, ...patch } = p;
    unwrap(await client.from(TX_TABLE).update(patch).eq('id', id).select('id'), 'bulk update');
  }

  await rebalanceMonths(client, [...months]);
  return { added: toInsert.length, updated: toUpdate.length, removed };
}

// ── 카테고리 / 설정 ─────────────────────────────────────────────────────

/** 카테고리 전체 교체(소수 항목): 목록에 있는 것은 upsert, 없는 것은 삭제. */
export async function replaceCategories(client, rawList) {
  if (!Array.isArray(rawList) || !rawList.length) fail(400, 'invalid-input', 'categories 배열이 필요합니다.');
  const rows = rawList.map(normalizeCategoryInput);
  if (new Set(rows.map((r) => r.id)).size !== rows.length) fail(400, 'invalid-input', '카테고리 id 중복');
  unwrap(await client.from(CAT_TABLE).upsert(rows, { onConflict: 'id' }).select('id'), 'category upsert');
  const current = unwrap(await client.from(CAT_TABLE).select('id'), 'category read') || [];
  const keep = new Set(rows.map((r) => r.id));
  const doomed = current.filter((c) => !keep.has(c.id)).map((c) => c.id);
  if (doomed.length) unwrap(await client.from(CAT_TABLE).delete().in('id', doomed).select('id'), 'category delete');
  return { count: rows.length, removed: doomed.length };
}

export async function putSetting(client, key, value, expectedVersion) {
  if (!SETTING_KEYS.has(key)) fail(400, 'invalid-input', '지원하지 않는 설정 key 입니다.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'invalid-input', 'value 는 객체여야 합니다.');
  const rows = unwrap(await client.from(SETTINGS_TABLE).select('key, version').eq('key', key), 'setting read');
  const cur = rows?.[0];
  if (!cur) {
    unwrap(await client.from(SETTINGS_TABLE).insert({ key, value }).select('key'), 'setting insert');
  } else {
    const version = requireExpectedVersion(expectedVersion);
    const updated = unwrap(
      await client.from(SETTINGS_TABLE).update({ value }).eq('key', key).eq('version', version).select('key'),
      'setting update'
    );
    if (!updated?.length) {
      fail(409, 'version-conflict', '설정이 다른 곳에서 먼저 수정되었습니다.', { currentVersion: cur.version });
    }
  }
  const after = unwrap(await client.from(SETTINGS_TABLE).select('key, value, version').eq('key', key), 'setting read');
  return after?.[0];
}
