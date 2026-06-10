#!/usr/bin/env node
import { head, put } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  JOURNAL_MEMBER_CODES,
  isMemberJournalEmpty,
  mergeMemberIntoJournalSnapshot,
  normalizeJournalCloudSnapshot,
} from '../src/utils/journalCloudSnapshot.js';

const LIVE_LATEST_PATH = 'journal/live-latest.json';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function usage() {
  console.log(`Usage:
  node scripts/import-journal-backup.mjs <backup.json>
  node scripts/import-journal-backup.mjs <backup.json> --apply

Default is dry-run. Set --apply to write journal/live-latest.json to Vercel Blob.`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }
  const apply = args.includes('--apply');
  const files = args.filter((arg) => arg !== '--apply');
  if (files.length !== 1) {
    usage();
    process.exit(1);
  }
  return { apply, backupPath: path.resolve(process.cwd(), files[0]) };
}

function getBlobToken() {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.tms_journal_READ_WRITE_TOKEN ||
    process.env.tms_ledger_READ_WRITE_TOKEN ||
    ''
  );
}

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function fetchBlobSnapshot(token) {
  try {
    const meta = await head(LIVE_LATEST_PATH, { token });
    const url = meta.downloadUrl || meta.url;
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return normalizeJournalCloudSnapshot(await res.json());
  } catch {
    return null;
  }
}

async function readStaticSnapshot() {
  const candidates = [
    path.join(root, 'public', 'journal-snapshot.json'),
    path.join(root, 'dist', 'journal-snapshot.json'),
  ];
  for (const filePath of candidates) {
    try {
      return normalizeJournalCloudSnapshot(await readJsonFile(filePath));
    } catch {
      continue;
    }
  }
  return null;
}

function memberStats(slice) {
  return {
    days: Object.keys(slice.days || {}).length,
    weekSummaries: Object.keys(slice.weekSummaries || {}).length,
    nextWeekPlans: Object.keys(slice.nextWeekPlans || {}).length,
    kpiWeekMemos: Object.keys(slice.kpiWeekMemos || {}).length,
    prefs: Boolean(slice.prefs),
  };
}

function maxIso(values) {
  const sorted = values
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return sorted[0] || new Date().toISOString();
}

function mergeBackupMembers(base, backup) {
  let merged = base;
  const imported = [];
  const skipped = [];

  JOURNAL_MEMBER_CODES.forEach((code) => {
    const source = backup.memberJournals[code];
    if (isMemberJournalEmpty(source)) {
      skipped.push(code);
      return;
    }
    const updatedAt =
      backup.meta.memberUpdatedAt?.[code] || backup.meta.updatedAt || backup.publishedAt;
    merged = mergeMemberIntoJournalSnapshot(merged, code, source, { updatedAt });
    imported.push(code);
  });

  const publishedAt = maxIso([
    base.publishedAt,
    backup.publishedAt,
    merged.publishedAt,
    new Date().toISOString(),
  ]);
  merged = normalizeJournalCloudSnapshot({
    ...merged,
    publishedAt,
    meta: {
      ...merged.meta,
      updatedAt: publishedAt,
    },
  });

  return { merged, imported, skipped };
}

async function writeBlobSnapshot(snapshot, token) {
  await put(LIVE_LATEST_PATH, JSON.stringify(snapshot, null, 2), {
    access: 'public',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

const { apply, backupPath } = parseArgs(process.argv);
const token = getBlobToken();

if (!token) {
  console.error(
    '❌ BLOB_READ_WRITE_TOKEN 또는 tms_journal_READ_WRITE_TOKEN 환경변수가 필요합니다.',
  );
  process.exit(1);
}

const backup = normalizeJournalCloudSnapshot(await readJsonFile(backupPath));
const blob = await fetchBlobSnapshot(token);
const staticSnapshot = blob ? null : await readStaticSnapshot();
const base = blob || staticSnapshot || normalizeJournalCloudSnapshot({});
const source = blob ? 'blob' : staticSnapshot ? 'static' : 'empty';
const { merged, imported, skipped } = mergeBackupMembers(base, backup);

console.log(`journal backup import ${apply ? 'APPLY' : 'DRY-RUN'}`);
console.log(`backup: ${backupPath}`);
console.log(`base: ${source}`);
console.log(`import members: ${imported.length ? imported.join(', ') : '(none)'}`);
console.log(`skip empty members: ${skipped.join(', ')}`);
JOURNAL_MEMBER_CODES.forEach((code) => {
  console.log(
    `${code}: before=${JSON.stringify(memberStats(base.memberJournals[code]))} after=${JSON.stringify(
      memberStats(merged.memberJournals[code]),
    )}`,
  );
});

if (!imported.length) {
  console.log('가져올 비어 있지 않은 member journal이 없습니다.');
  process.exit(0);
}

if (!apply) {
  console.log('dry-run 완료: 실제 Blob에는 쓰지 않았습니다. 적용하려면 --apply를 붙이세요.');
  process.exit(0);
}

await writeBlobSnapshot(merged, token);
console.log(`✅ applied: ${LIVE_LATEST_PATH}`);
