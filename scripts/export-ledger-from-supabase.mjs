#!/usr/bin/env node
/**
 * Supabase ledger_* → 스냅샷 JSON (읽기 전용, anon 키로 충분).
 * 백업과 롤백 용도: 같은 모양의 JSON 이라 「장부 JSON 백업 가져오기」나 migrate-ledger-to-supabase.mjs 의 입력으로 쓸 수 있다.
 * Blob 에는 아무것도 쓰지 않는다.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/export-ledger-from-supabase.mjs ./ledger-export.json
 */
import { writeFileSync } from 'node:fs';
import { buildSnapshotFromRows } from '../src/utils/ledgerSnapshotMapping.js';

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_ANON_KEY || '';
const out = process.argv[2];
if (!url || !key || !out) {
  console.error('SUPABASE_URL, SUPABASE_ANON_KEY 환경변수와 출력 파일 경로가 필요합니다.');
  process.exit(1);
}

async function readAll(table, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&order=${order}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`${table} → ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const [transactions, categories, settings] = await Promise.all([
  readAll('ledger_transactions', 'tx_date.asc,sort_order.asc'),
  readAll('ledger_categories', 'sort_order.asc'),
  readAll('ledger_settings', 'key.asc'),
]);
const snapshot = buildSnapshotFromRows({ transactions, categories, settings });
if (!snapshot) {
  console.error('ledger_transactions 가 비어 있어 내보낼 내용이 없습니다.');
  process.exit(1);
}
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`내보내기 완료: 거래 ${snapshot.transactions.length}건 · 카테고리 ${snapshot.categories.length}개 → ${out}`);
