/** 지출 장부 — 전월·행 단위 복사 */

export function getPreviousMonth(yearStr, monthStr) {
  let y = parseInt(yearStr, 10);
  let m = parseInt(monthStr, 10);
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return { year: String(y), month: String(m).padStart(2, '0') };
}

/** 같은 일(day)을 목표 연·월로 옮김 (31일 → 2월이면 말일로) */
export function remapDateToMonth(isoDate, targetYear, targetMonth) {
  const parts = String(isoDate || '').split('-');
  const day = parts.length >= 3 ? parseInt(parts[2], 10) : 1;
  const y = parseInt(targetYear, 10);
  const m = parseInt(targetMonth, 10);
  const lastDay = new Date(y, m, 0).getDate();
  const safeDay = Math.min(Math.max(1, day || 1), lastDay);
  return `${targetYear}-${targetMonth}-${String(safeDay).padStart(2, '0')}`;
}

export function transactionDedupeKey(tx) {
  return `${tx.date}|${tx.category}|${tx.description}|${tx.amount}|${tx.paymentMethod}`;
}

export function cloneLedgerTransaction(tx, targetYear, targetMonth, { newId = true } = {}) {
  return {
    ...tx,
    id: newId ? `tx-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : tx.id,
    date: remapDateToMonth(tx.date, targetYear, targetMonth),
    balance: 0,
    extraData: tx.extraData ? { ...tx.extraData } : {},
  };
}
