export const MONTHLY_BUDGET = 150000;

/** 날짜순 정렬 후 월별 15만 원 기준 잔액 계산 */
export function calculateBalances(items) {
  const sorted = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));

  const groups = {};
  sorted.forEach((item) => {
    const yyyymm = item.date.slice(0, 7);
    if (!groups[yyyymm]) groups[yyyymm] = [];
    groups[yyyymm].push(item);
  });

  Object.keys(groups).forEach((yyyymm) => {
    let runningBalance = MONTHLY_BUDGET;
    groups[yyyymm].forEach((tx) => {
      runningBalance -= tx.amount;
      tx.balance = runningBalance;
    });
  });

  return sorted;
}
