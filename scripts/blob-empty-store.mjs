#!/usr/bin/env node
/** Vercel CLI로 Blob 스토어 비우기 (rate limit 시 몇 분 뒤 재시도) */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const STORE_ID = process.env.BLOB_STORE_ID || 'store_1qyUmOkIsduov5gF';

const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.tms_ledger_READ_WRITE_TOKEN;
if (!token) {
  console.error('❌ BLOB_READ_WRITE_TOKEN 필요 (vercel env pull --environment=production)');
  process.exit(1);
}

const r = spawnSync(
  'npx',
  ['vercel@latest', 'blob', 'empty-store', STORE_ID, '--rw-token', token, '--yes'],
  { cwd: root, stdio: 'inherit', env: process.env }
);
process.exit(r.status ?? 1);
