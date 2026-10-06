/**
 * 서버(Supabase) 장부 모드의 삭제 보호.
 * 서버 모드에서는 삭제가 곧바로 운영 DB에 반영되므로, 한 번의 확인창으로 여러 건을 지우지 못하게 한다.
 * - 한 번에 지울 수 있는 건수 상한, 장부 전체 삭제 차단 (훅에서 모든 경로에 적용)
 * - 여러 건 삭제는 건수를 직접 입력해야 진행 (화면에서 적용)
 */
export const MAX_DELETE_PER_ACTION = 30;
/** 이 건수 이상을 지우는 "선택 삭제"도 입력 확인을 요구한다. */
export const TYPED_CONFIRM_FROM = 5;

/**
 * @returns {{ ok: true } | { ok: false, reason: 'all' | 'too-many', message: string }}
 */
export function checkDeletionGuard(removeCount, totalCount) {
  if (!removeCount) return { ok: true };
  if (totalCount > 0 && removeCount >= totalCount) {
    return {
      ok: false,
      reason: 'all',
      message:
        '서버 장부의 모든 거래를 한 번에 삭제할 수 없어 중단했습니다. 정말 비워야 한다면 장부 JSON 백업을 받은 뒤 관리자에게 문의하세요.',
    };
  }
  if (removeCount > MAX_DELETE_PER_ACTION) {
    return {
      ok: false,
      reason: 'too-many',
      message: `한 번에 ${MAX_DELETE_PER_ACTION}건까지만 삭제할 수 있어 중단했습니다. (요청 ${removeCount}건) 나누어 삭제해 주세요.`,
    };
  }
  return { ok: true };
}

/**
 * 삭제 확인 방식을 정한다.
 * @param {{ count: number, scopeLabel: string, kind: 'selected' | 'all-visible' }} args
 * @returns {{ mode: 'confirm' | 'typed', message: string, phrase: string }}
 */
export function bulkDeleteConfirmation({ count, scopeLabel, kind }) {
  const phrase = `${count}건 삭제`;
  const typed = kind === 'all-visible' || count >= TYPED_CONFIRM_FROM;
  if (!typed) {
    return {
      mode: 'confirm',
      phrase,
      message: `선택한 ${count}건의 지출 내역을 삭제할까요?\n삭제 후에는 되돌릴 수 없습니다.`,
    };
  }
  return {
    mode: 'typed',
    phrase,
    message:
      `${scopeLabel}을 서버 장부에서 삭제합니다.\n` +
      '팀원 조회 화면에도 즉시 반영되고 되돌릴 수 없습니다.\n\n' +
      `계속하려면 아래 칸에 「${phrase}」 를 그대로 입력하세요.`,
  };
}

export function isTypedConfirmationValid(input, phrase) {
  return String(input ?? '').trim() === phrase;
}
