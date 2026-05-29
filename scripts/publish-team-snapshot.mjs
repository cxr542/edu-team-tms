#!/usr/bin/env node
/**
 * 팀장이 앱에서 받은 ledger-snapshot.json → public/ledger-snapshot.json 반영
 * 사용: npm run publish:team
 *       npm run publish:team -- ./ledger-snapshot.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'public/ledger-snapshot.json');

const argPath = process.argv[2];
const candidates = [
  argPath && path.resolve(process.cwd(), argPath),
  path.join(root, 'ledger-snapshot.json'),
  path.join(root, 'snapshots/ledger-snapshot.json'),
].filter(Boolean);

let srcPath = candidates.find((p) => fs.existsSync(p));

if (!srcPath) {
  if (fs.existsSync(outPath)) {
    console.log('ℹ️  ledger-snapshot 소스 없음 → 기존 public/ledger-snapshot.json 유지');
    process.exit(0);
  }
  const bundled = path.join(root, 'src/data/teamBuilding2026.json');
  if (fs.existsSync(bundled)) {
    console.log('ℹ️  ledger-snapshot.json 없음 → teamBuilding2026.json 으로 초기 공개 장부 생성');
    const transactions = JSON.parse(fs.readFileSync(bundled, 'utf8'));
    const payload = {
      publishedAt: new Date().toISOString(),
      categories: null,
      transactions,
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`✅ ${transactions.length}건 → ${outPath}`);
    process.exit(0);
  }
  console.error('❌ ledger-snapshot.json 을 찾을 수 없습니다.');
  console.error('   앱에서 「팀 조회용 게시」로 받은 파일을 프로젝트 루트에 두거나 경로를 인자로 주세요.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
if (!Array.isArray(raw.transactions)) {
  console.error('❌ transactions 배열이 필요합니다.');
  process.exit(1);
}

const payload = {
  publishedAt: raw.publishedAt || new Date().toISOString(),
  categories: raw.categories ?? null,
  transactions: raw.transactions,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(`✅ ${payload.transactions.length}건 게시 (${payload.publishedAt})`);
console.log(`   → ${outPath}`);
console.log('   다음: npm run build 후 dist/ 를 호스팅에 배포');
