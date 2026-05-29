#!/usr/bin/env node
/**
 * journal-snapshot.json → public/journal-snapshot.json (Vercel 동기화용)
 * 사용: npm run publish:journal
 *       npm run publish:journal -- ~/Downloads/journal-snapshot-....json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'public/journal-snapshot.json');

const argPath = process.argv[2];
const candidates = [
  argPath && path.resolve(process.cwd(), argPath),
  path.join(root, 'journal-snapshot.json'),
  path.join(root, 'snapshots/journal-snapshot.json'),
].filter(Boolean);

const srcPath = candidates.find((p) => fs.existsSync(p));

if (!srcPath) {
  if (fs.existsSync(outPath)) {
    console.log('ℹ️  journal-snapshot 소스 없음 → 기존 public/journal-snapshot.json 유지');
    process.exit(0);
  }
  console.error('❌ journal-snapshot.json 을 찾을 수 없습니다.');
  console.error('   앱 「클라우드에 게시」로 받은 파일을 프로젝트 루트에 두거나 경로를 인자로 주세요.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
if (!raw.days || typeof raw.days !== 'object') {
  console.error('❌ days 객체가 필요합니다.');
  process.exit(1);
}

const payload = {
  publishedAt: raw.publishedAt || new Date().toISOString(),
  member: raw.member || 'A',
  days: raw.days,
  weekSummaries: raw.weekSummaries || {},
  nextWeekPlans: raw.nextWeekPlans || {},
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`✅ 일지 스냅샷 게시 (${payload.publishedAt})`);
console.log(`   → ${outPath}`);
console.log('   다음: npm run deploy:vercel');
