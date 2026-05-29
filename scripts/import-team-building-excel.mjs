/**
 * OneDrive 팀 빌딩비 엑셀 → src/data/teamBuilding2026.json
 * Usage: node scripts/import-team-building-excel.mjs [path-to-xlsx]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import {
  resolveUsageCategory,
  normalizeAttendees,
} from '../src/constants/usageCategories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath =
  '/Users/yhkim/Library/CloudStorage/OneDrive-오케스트로/최 우성의 파일 - 00.오케스트로 아카데미(아카데미팀 공유폴더)/기획운영 폴더/00. 팀 빌딩/26년 교육팀 팀 빌딩비.xlsx';

const excelPath = process.argv[2] || defaultPath;
const outPath = path.join(__dirname, '../src/data/teamBuilding2026.json');

const MEALS = [
  { col: 1, label: '아침' },
  { col: 2, label: '점심' },
  { col: 3, label: '저녁' },
  { col: 4, label: '간식' },
];

function parseAmount(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function excelDateToIso(v) {
  if (typeof v === 'number' && v > 30000) {
    const d = XLSX.SSF.parse_date_code(v);
    const m = String(d.m).padStart(2, '0');
    const day = String(d.d).padStart(2, '0');
    return `${d.y}-${m}-${day}`;
  }
  return null;
}

if (!fs.existsSync(excelPath)) {
  console.error('파일 없음:', excelPath);
  process.exit(1);
}

const wb = XLSX.readFile(excelPath);
const txs = [];
let id = 0;

for (const sheetName of wb.SheetNames) {
  if (!/^\d{2}년\s*\d{1,2}월$/.test(sheetName)) continue;

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const date = excelDateToIso(row[0]);
    if (!date) continue;

    const note = String(row[7] || '').trim();
    const attendees = normalizeAttendees(String(row[8] || '').trim());
    let any = false;

    for (const meal of MEALS) {
      const amt = parseAmount(row[meal.col]);
      if (amt <= 0) continue;
      any = true;

      const descParts = [meal.label];
      if (note) descParts.push(note);

      txs.push({
        id: `tx-excel-${++id}`,
        date,
        category: resolveUsageCategory({ note, mealLabel: meal.label }),
        description: descParts.join(' · '),
        amount: amt,
        balance: 0,
        paymentMethod: '법인카드',
        attendees,
        extraData: note ? { 비고: note } : {},
      });
    }

    const subtotal = parseAmount(row[5]);
    if (!any && subtotal > 0) {
      txs.push({
        id: `tx-excel-${++id}`,
        date,
        category: resolveUsageCategory({ note }),
        description: note || `일일 지출 (${sheetName})`,
        amount: subtotal,
        balance: 0,
        paymentMethod: '법인카드',
        attendees,
        extraData: note ? { 비고: note } : {},
      });
    }
  }
}

txs.sort((a, b) => new Date(a.date) - new Date(b.date));

const groups = {};
for (const t of txs) {
  const ym = t.date.slice(0, 7);
  if (!groups[ym]) groups[ym] = [];
  groups[ym].push(t);
}
for (const ym of Object.keys(groups).sort()) {
  let bal = 150000;
  for (const t of groups[ym]) {
    bal -= t.amount;
    t.balance = bal;
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(txs, null, 2));
console.log(`✅ ${txs.length}건 → ${outPath}`);
