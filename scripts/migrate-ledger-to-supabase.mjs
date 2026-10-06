#!/usr/bin/env node
/**
 * Ledger snapshot JSON → Supabase (ledger_transactions / ledger_categories / ledger_settings).
 *
 * DRY-RUN BY DEFAULT. Nothing is written unless --execute is passed.
 * Vercel Blob is never read or written here; the source is a local JSON file.
 *
 * Usage:
 *   # dry-run, assuming the tables are empty (no network)
 *   node scripts/migrate-ledger-to-supabase.mjs --source <snapshot.json> --assume-empty
 *   # dry-run against the live tables (read-only; anon key is enough)
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/migrate-ledger-to-supabase.mjs --source <snapshot.json>
 *   # real run (service role key, only after approval)
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-ledger-to-supabase.mjs --source <snapshot.json> --execute
 */

import { readFileSync } from 'node:fs';
import {
  CAT_KEYS,
  SETTING_KEYS,
  TX_KEYS,
  classifyRows,
  summarize,
  toCategoryRow,
  toSettingRows,
  toTransactionRow,
  validateSnapshot,
} from './ledger-migration-core.mjs';

function parseArgs(argv) {
  const args = { source: null, execute: false, assumeEmpty: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--source') args.source = argv[++i];
    else if (argv[i] === '--execute') args.execute = true;
    else if (argv[i] === '--assume-empty') args.assumeEmpty = true;
  }
  return args;
}

const TABLES = [
  { name: 'ledger_categories', pk: 'id', keys: CAT_KEYS },
  { name: 'ledger_transactions', pk: 'id', keys: TX_KEYS },
  { name: 'ledger_settings', pk: 'key', keys: SETTING_KEYS },
];

async function rest(url, key, path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function fetchAll(url, key, table, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = await rest(url, key, `${table}?select=*&order=${order}`, {
      headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const args = parseArgs(process.argv);
if (!args.source) {
  console.error('--source <snapshot.json> is required');
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(args.source, 'utf8'));
const problems = validateSnapshot(snapshot);
if (problems.length) {
  console.error('원본 검증 실패 — 중단합니다:');
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

const desired = {
  ledger_categories: (snapshot.categories ?? []).map(toCategoryRow),
  ledger_transactions: snapshot.transactions.map(toTransactionRow),
  ledger_settings: toSettingRows(snapshot),
};

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = args.execute
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (args.execute && (!url || !key)) {
  console.error('--execute 에는 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
  process.exit(1);
}
if (!args.execute && !args.assumeEmpty && (!url || !key)) {
  console.error('DB와 비교하려면 SUPABASE_URL + SUPABASE_ANON_KEY 를 설정하거나, 빈 테이블 가정 시 --assume-empty 를 쓰세요.');
  process.exit(1);
}

console.log(`mode: ${args.execute ? 'EXECUTE (writes)' : 'DRY-RUN (no writes)'}`);
console.log(`source: ${args.source}`);
console.log(`existing rows: ${args.assumeEmpty && !args.execute ? 'assumed empty' : 'read from Supabase'}\n`);

const plan = {};
for (const t of TABLES) {
  const existing = args.assumeEmpty && !args.execute ? [] : await fetchAll(url, key, t.name, t.pk);
  plan[t.name] = classifyRows(desired[t.name], existing, t.pk, t.keys);
  const p = plan[t.name];
  const orphans = existing.filter((r) => !desired[t.name].some((d) => d[t.pk] === r[t.pk])).length;
  console.log(
    `${t.name.padEnd(20)} 추가 ${String(p.add.length).padStart(3)} · 수정 ${String(p.update.length).padStart(3)} · 건너뜀 ${String(p.skip.length).padStart(3)}` +
      (orphans ? ` · DB에만 있음 ${orphans} (삭제하지 않음)` : '')
  );
}

const s = summarize(desired.ledger_transactions);
console.log(`\n이관 대상 기준값: 거래 ${s.total}건`);
for (const [m, v] of Object.entries(s.months)) {
  console.log(`  ${m}  ${String(v.count).padStart(2)}건  합계 ${String(v.sum).padStart(7)}  월말잔액 ${v.lastBalance}`);
}

if (!args.execute) {
  console.log('\nDRY-RUN 종료 — DB에는 아무것도 쓰지 않았습니다.');
  process.exit(0);
}

// Only new/changed rows are sent, so re-running never bumps `version` on unchanged rows.
for (const t of TABLES) {
  const rows = [...plan[t.name].add, ...plan[t.name].update];
  for (let i = 0; i < rows.length; i += 200) {
    await rest(url, key, `${t.name}?on_conflict=${t.pk}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 200)),
    });
  }
  console.log(`${t.name}: ${rows.length}행 기록`);
}
console.log('\n완료. 단계 4 대조를 실행하세요.');
