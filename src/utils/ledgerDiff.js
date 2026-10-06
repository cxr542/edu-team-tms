/**
 * 편집 화면은 "전체 새 목록"을 만들어 넘긴다. 서버에는 변경된 행만 보내야 하므로
 * 현재 목록과 새 목록을 비교해 추가/수정/삭제 계획을 만든다. (balance·_version 은 비교하지 않는다)
 */

/** 서버에 저장되는 필드만 뽑아 안정적인 문자열로 만든다. {} 와 undefined 는 같다. */
export function txPersistKey(tx) {
  const extra = tx.extraData && typeof tx.extraData === 'object' ? tx.extraData : {};
  const sortedExtra = Object.fromEntries(Object.keys(extra).sort().map((k) => [k, extra[k] ?? '']));
  return JSON.stringify([
    tx.date ?? '',
    tx.category ?? '',
    tx.description ?? '',
    Number(tx.amount) || 0,
    tx.paymentMethod || '',
    tx.attendees || '',
    sortedExtra,
  ]);
}

/** 서버로 보낼 거래 객체 (balance·_version 제거) */
export function toApiTransaction(tx) {
  const { balance: _b, _version: _v, ...rest } = tx;
  return rest;
}

export function stripLedgerMeta(transactions = []) {
  return transactions.map(toApiTransaction);
}

/**
 * @returns {{ adds: object[], updates: Array<{tx: object, version: number|null}>, removes: Array<{id: string, version: number|null}>, isEmpty: boolean }}
 */
export function planLedgerChanges(prevList = [], nextList = []) {
  const seen = new Set();
  for (const tx of nextList) {
    if (!tx?.id) throw new Error('id 가 없는 거래가 있습니다.');
    if (seen.has(tx.id)) throw new Error(`중복된 거래 id: ${tx.id}`);
    seen.add(tx.id);
  }
  const prevById = new Map(prevList.map((t) => [t.id, t]));
  const adds = [];
  const updates = [];
  for (const tx of nextList) {
    const prev = prevById.get(tx.id);
    if (!prev) adds.push(toApiTransaction(tx));
    else if (txPersistKey(prev) !== txPersistKey(tx)) {
      updates.push({ tx: toApiTransaction(tx), version: prev._version ?? null });
    }
  }
  const removes = prevList
    .filter((t) => !seen.has(t.id))
    .map((t) => ({ id: t.id, version: t._version ?? null }));
  return { adds, updates, removes, isEmpty: !adds.length && !updates.length && !removes.length };
}
