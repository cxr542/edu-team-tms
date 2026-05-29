/** 차주(예정)·금주(요약) 카테고리/하위 항목 줄머리 */
export const WEEK_COLUMN_SUB_PREFIX = '└ ';

/** 하위 항목(└, ㄴ 등) */
const SUB_LINE_RE = /^(\s*)(?:└|ㄴ|L)\s*/;
/** 카테고리(•) */
const CAT_LINE_RE = /^(\s*)•\s*/;

/**
 * Enter 시 다음 줄에 넣을 접두사. 없으면 null(기본 Enter).
 * @param {string} line - 커서가 있는 줄 전체
 */
export function getWeekColumnEnterPrefix(line) {
  if (SUB_LINE_RE.test(line)) return WEEK_COLUMN_SUB_PREFIX;
  if (CAT_LINE_RE.test(line)) return WEEK_COLUMN_SUB_PREFIX;
  return null;
}

/**
 * @param {string} value
 * @param {number} cursorStart
 * @returns {{ newValue: string, newCursor: number } | null}
 */
export function applyWeekColumnEnter(value, cursorStart) {
  const before = value.slice(0, cursorStart);
  const after = value.slice(cursorStart);
  const lineStart = before.lastIndexOf('\n') + 1;
  const nextBreak = after.indexOf('\n');
  const lineEnd = cursorStart + (nextBreak === -1 ? after.length : nextBreak);
  const currentLine = value.slice(lineStart, lineEnd);

  const prefix = getWeekColumnEnterPrefix(currentLine);
  if (!prefix) return null;

  const insert = `\n${prefix}`;
  return {
    newValue: before + insert + after,
    newCursor: cursorStart + insert.length,
  };
}
