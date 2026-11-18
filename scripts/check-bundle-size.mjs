#!/usr/bin/env node
/**
 * 첫 화면에서 바로 받는 JS(엔트리 + modulepreload)의 gzip 합계가 상한을 넘으면 실패한다.
 * `npm run build` 뒤에 실행한다. CI(.github/workflows/ci-pr.yml)에서 PR마다 돈다.
 *
 * 상한을 넘었다면: 새 화면은 React.lazy로, 큰 라이브러리는 import()로 필요할 때 불러오도록 바꾼다.
 * 정말 필요해서 늘리는 경우에만 INITIAL_JS_GZIP_BUDGET_KB를 올리고 PR에 이유를 적는다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// 2026-11 기준 초기 JS gzip 189.7 kB + 약 10% 여유
const INITIAL_JS_GZIP_BUDGET_KB = 210;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, process.argv[2] || 'dist');

let html;
try {
  html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
} catch {
  console.error(`check-bundle-size: ${path.join(DIST, 'index.html')} not found. Run "npm run build" first.`);
  process.exit(2);
}

const toFile = (url) => path.join(DIST, url.replace(/^\//, '').replace(/^.*?assets\//, 'assets/'));
const entries = [...html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+\.js)"/g)].map((m) => m[1]);
const preloads = [...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+\.js)"/g)].map((m) => m[1]);
const files = [...new Set([...entries, ...preloads])];

if (entries.length === 0) {
  console.error('check-bundle-size: no module entry script found in index.html.');
  process.exit(2);
}

let totalGzip = 0;
for (const url of files) {
  const bytes = readFileSync(toFile(url));
  const gzip = gzipSync(bytes, { level: 9 }).length;
  totalGzip += gzip;
  console.log(`  ${url}  ${(bytes.length / 1024).toFixed(1)} kB  (gzip ${(gzip / 1024).toFixed(1)} kB)`);
}

const totalKb = totalGzip / 1024;
const summary = `initial JS gzip ${totalKb.toFixed(1)} kB / budget ${INITIAL_JS_GZIP_BUDGET_KB} kB`;
if (totalKb > INITIAL_JS_GZIP_BUDGET_KB) {
  console.error(`check-bundle-size: FAIL — ${summary}`);
  process.exit(1);
}
console.log(`check-bundle-size: OK — ${summary}`);
