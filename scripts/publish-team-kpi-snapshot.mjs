#!/usr/bin/env node
/**
 * team-kpi-snapshot.json → public/team-kpi-snapshot.json
 * 사용: npm run publish:kpi
 *       npm run publish:kpi -- ~/Downloads/team-kpi-snapshot-....json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'public/team-kpi-snapshot.json');

const argPath = process.argv[2];
const candidates = [
  argPath && path.resolve(process.cwd(), argPath),
  path.join(root, 'team-kpi-snapshot.json'),
  path.join(root, 'snapshots/team-kpi-snapshot.json'),
].filter(Boolean);

const srcPath = candidates.find((p) => fs.existsSync(p));

if (!srcPath) {
  if (fs.existsSync(outPath)) {
    console.log('ℹ️  team-kpi-snapshot 소스 없음 → 기존 public 유지');
    process.exit(0);
  }
  const empty = {
    publishedAt: new Date().toISOString(),
    kpiOperational: { meta: { version: 2 }, kpiWeekMemos: {}, months: {}, quarters: {}, kpi2RowStatus: {} },
  };
  fs.writeFileSync(outPath, JSON.stringify(empty, null, 2));
  console.log(`✅ 빈 KPI 스냅샷 생성 → ${outPath}`);
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
if (!raw.kpiOperational) {
  console.error('❌ kpiOperational 객체가 필요합니다.');
  process.exit(1);
}

const payload = {
  publishedAt: raw.publishedAt || new Date().toISOString(),
  journalUpdatedAt: raw.journalUpdatedAt || null,
  kpiOperational: raw.kpiOperational,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`✅ KPI 스냅샷 게시 (${payload.publishedAt})`);
console.log(`   → ${outPath}`);
