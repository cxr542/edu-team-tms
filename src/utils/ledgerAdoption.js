function countByYearMonth(transactions = []) {
  return transactions.reduce((acc, tx) => {
    const ym = String(tx?.date || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      acc[ym] = (acc[ym] || 0) + 1;
    }
    return acc;
  }, {});
}

/**
 * 백업 JSON 으로 장부를 "교체"하기 전 안전 점검.
 * 가져올 데이터가 현재보다 적거나 현재 있는 달이 사라지면 중단한다.
 */
export function validateLedgerSnapshotAdoption(currentTransactions = [], incomingTransactions = []) {
  if (!currentTransactions.length || !incomingTransactions.length) {
    return { ok: true };
  }

  if (incomingTransactions.length < currentTransactions.length) {
    return {
      ok: false,
      reason: 'transaction-count-decrease',
      currentCount: currentTransactions.length,
      incomingCount: incomingTransactions.length,
    };
  }

  const currentMonths = countByYearMonth(currentTransactions);
  const incomingMonths = countByYearMonth(incomingTransactions);
  const removedMonth = Object.keys(currentMonths).find(
    (ym) => currentMonths[ym] > 0 && !incomingMonths[ym]
  );

  if (removedMonth) {
    return {
      ok: false,
      reason: 'month-data-removed',
      month: removedMonth,
      currentCount: currentMonths[removedMonth],
      incomingCount: incomingMonths[removedMonth] || 0,
    };
  }

  return { ok: true };
}
