#!/usr/bin/env node
/**
 * Vercel Blob `ledger/live-` 스냅샷 정리
 * @see https://vercel.com/docs/vercel-blob/examples (delete in batches)
 */
import { del, list } from '@vercel/blob';

const PREFIX = 'ledger/live-';
const keep = (() => {
  const i = process.argv.indexOf('--keep');
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 3) : 3;
})();
const dryRun = process.argv.includes('--dry-run');
const LIST_LIMIT = 50;
const DELAY_MS = 5000;
const wipeAll = process.argv.includes('--wipe-all');

const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.tms_ledger_READ_WRITE_TOKEN;
if (!token) {
  console.error('❌ BLOB_READ_WRITE_TOKEN 이 필요합니다.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function delBatch(urls) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await del(urls, { token });
      return;
    } catch (e) {
      const wait = e?.retryAfter ? e.retryAfter * 1000 : 65000;
      if (/rate|too many|429/i.test(String(e.message)) && attempt < 5) {
        console.log(`  rate limit — ${Math.round(wait / 1000)}s 대기…`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

async function countAll() {
  let n = 0;
  let cursor;
  do {
    const res = await list({ prefix: PREFIX, token, limit: 1000, cursor });
    n += res.blobs.length;
    cursor = res.cursor;
  } while (cursor);
  return n;
}

const before = await countAll();
console.log(`${PREFIX}* 현재 ${before}개 (유지 ${keep}개 목표)`);

if (before <= keep) {
  console.log('정리할 항목 없음');
  process.exit(0);
}

if (dryRun) {
  console.log(`(dry-run) 약 ${before - keep}개 삭제 예정`);
  process.exit(0);
}

let totalDeleted = 0;
let round = 0;

while (true) {
  const { blobs } = await list({ prefix: PREFIX, token, limit: LIST_LIMIT });
  if (!blobs.length) {
    console.log('남은 파일 없음 — 완료');
    break;
  }
  if (!wipeAll && blobs.length <= keep) {
    console.log(`남은 ${blobs.length}개 — 완료`);
    break;
  }

  const sorted = [...blobs].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  const urls = (wipeAll ? sorted : sorted.slice(keep)).map((b) => b.url);
  if (!urls.length) break;
  await delBatch(urls);
  totalDeleted += urls.length;
  round += 1;
  if (round % 10 === 0 || urls.length < LIST_LIMIT) {
    console.log(`  라운드 ${round}: 누적 삭제 ${totalDeleted}개`);
  }
  await sleep(DELAY_MS);
}

const after = await countAll();
console.log(`✅ 삭제 ${totalDeleted}개 · 남음 ${after}개`);
console.log('   Edit 화면에서 「지금 조회에 반영」을 다시 누르세요.');
