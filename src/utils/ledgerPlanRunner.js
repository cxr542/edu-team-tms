/**
 * planLedgerChanges 결과를 서버 API 로 실행한다.
 * - 삭제 → 수정 → 추가 순. 수정·삭제는 version 으로 충돌을 감지한다.
 * - 같은 세션에서 앞서 올린 버전은 versions(Map)로 이어받아, 연속 편집이 서로 충돌로 오인되지 않게 한다.
 * - 여러 건 추가나 대량 수정은 bulk(merge)로 보낸다(수정은 이 경우 버전 검사를 하지 않는다).
 */
const BULK_UPDATE_THRESHOLD = 20;

export async function applyLedgerPlan(api, plan, { versions = new Map() } = {}) {
  const counts = { added: 0, updated: 0, removed: 0 };
  const versionOf = (id, fallback) => versions.get(id) ?? fallback;

  for (const { id, version } of plan.removes) {
    const v = versionOf(id, version);
    if (v == null) throw new Error(`삭제할 항목(${id})의 버전을 알 수 없습니다. 새로고침 후 다시 시도하세요.`);
    await api.deleteTransaction(id, v);
    versions.delete(id);
    counts.removed += 1;
  }

  if (plan.updates.length > BULK_UPDATE_THRESHOLD) {
    await api.bulkTransactions(plan.updates.map((u) => u.tx), { mode: 'merge' });
    counts.updated += plan.updates.length;
    plan.updates.forEach((u) => versions.delete(u.tx.id)); // 서버 버전이 바뀌었으니 다시 읽을 때까지 모름
  } else {
    for (const { tx, version } of plan.updates) {
      const v = versionOf(tx.id, version);
      if (v == null) throw new Error(`수정할 항목(${tx.id})의 버전을 알 수 없습니다. 새로고침 후 다시 시도하세요.`);
      const res = await api.updateTransaction(tx.id, tx, v);
      if (res?.transaction?.version != null) versions.set(tx.id, res.transaction.version);
      counts.updated += 1;
    }
  }

  if (plan.adds.length === 1) {
    const res = await api.createTransaction(plan.adds[0]);
    if (res?.transaction?.version != null) versions.set(res.transaction.id, res.transaction.version);
    counts.added += 1;
  } else if (plan.adds.length > 1) {
    await api.bulkTransactions(plan.adds, { mode: 'merge' });
    counts.added += plan.adds.length;
  }
  return counts;
}

export function describeCounts({ added, updated, removed }) {
  const parts = [];
  if (added) parts.push(`추가 ${added}`);
  if (updated) parts.push(`수정 ${updated}`);
  if (removed) parts.push(`삭제 ${removed}`);
  return parts.join(' · ');
}
