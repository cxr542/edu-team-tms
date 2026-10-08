/**
 * 근거 텍스트 가독성 — "1. … 2. … 3. …" 처럼 한 줄에 이어 붙은 번호 항목에 줄바꿈을 넣는다.
 * 1부터 순서대로 이어지는 번호만 대상으로 삼아 "2026. 10. 8." 같은 날짜는 건드리지 않는다.
 */
export function formatNumberedItems(text) {
  const source = String(text ?? '');
  const re = /(^|\s)(\d{1,2})\.\s/g;
  const breaks = [];
  let expected = 1;
  let match;
  while ((match = re.exec(source)) !== null) {
    const n = Number(match[2]);
    if (n !== expected) continue;
    if (n >= 2) breaks.push({ start: match.index, len: match[1].length });
    expected += 1;
    re.lastIndex = match.index + match[0].length - 1;
  }
  if (breaks.length === 0) return source;
  let out = '';
  let cursor = 0;
  breaks.forEach(({ start, len }) => {
    out += source.slice(cursor, start);
    // 이미 줄바꿈으로 구분된 항목은 그대로 둔다
    out += /\n/.test(source.slice(start, start + len)) ? source.slice(start, start + len) : '\n';
    cursor = start + len;
  });
  return out + source.slice(cursor);
}

export function needsNumberedItemBreaks(text) {
  return formatNumberedItems(text) !== String(text ?? '');
}
