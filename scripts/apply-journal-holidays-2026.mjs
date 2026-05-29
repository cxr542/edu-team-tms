#!/usr/bin/env node
/**
 * journal-snapshot / seed 의 2026 공휴일 → 휴일 M/M 1.0 반영
 * 사용: node scripts/apply-journal-holidays-2026.mjs [json경로]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const KR_DATES = [
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-03-01', '2026-03-02',
  '2026-05-01', '2026-05-05', '2026-05-24', '2026-05-25',
  '2026-06-03', '2026-06-06',
  '2026-07-17',
  '2026-08-15', '2026-08-17',
  '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-05', '2026-10-09',
  '2026-12-25',
];

function holidayDay(prev) {
  return {
    holiday: true,
    mm: { work: 0, improve: 0, leave: 1 },
    tasks: prev?.tasks ?? [],
  };
}

function apply(days) {
  const next = { ...days };
  let n = 0;
  for (const date of KR_DATES) {
    const prev = next[date];
    if (!prev || prev.mm?.leave !== 1 || !prev.holiday) {
      next[date] = holidayDay(prev);
      n += 1;
    }
  }
  return { days: next, updated: n };
}

const target =
  process.argv[2] ||
  path.join(root, 'public/journal-snapshot.json');

if (!fs.existsSync(target)) {
  console.error('파일 없음:', target);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(target, 'utf8'));
const { days, updated } = apply(raw.days || {});
raw.days = days;
raw.publishedAt = raw.publishedAt || new Date().toISOString();
fs.writeFileSync(target, JSON.stringify(raw, null, 2));
console.log(`✅ ${target} — 공휴일 ${updated}일 반영`);
