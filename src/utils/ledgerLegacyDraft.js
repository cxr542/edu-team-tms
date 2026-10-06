import { planLedgerChanges } from './ledgerDiff';

/**
 * 이관 전 브라우저에 남은 작성본(localStorage)이 서버 기준과 얼마나 다른지 판정한다.
 * 자동으로 올리거나 지우지 않는다 — 'diverged' 이면 사용자가 백업/폐기를 고르게 한다.
 * @returns {{ status: 'none'|'identical'|'diverged', onlyLocal: number, differing: number, total: number }}
 */
export function classifyLegacyDraft(serverTransactions = [], draft = null) {
  if (!Array.isArray(draft) || draft.length === 0) {
    return { status: 'none', onlyLocal: 0, differing: 0, total: 0 };
  }
  const plan = planLedgerChanges(serverTransactions, draft);
  const onlyLocal = plan.adds.length;
  const differing = plan.updates.length;
  return {
    status: onlyLocal + differing === 0 ? 'identical' : 'diverged',
    onlyLocal,
    differing,
    total: draft.length,
  };
}
