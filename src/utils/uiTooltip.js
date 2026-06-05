/**
 * 마우스 호버·포커스 시 CSS 툴팁 (data-ui-tooltip) + 접근성 title
 * @param {string} text
 * @param {'below'|undefined} pos
 * @param {{ wrap?: boolean }} [opts] — wrap: true면 긴 문장만 2줄 줄바꿈
 */
export function uiTooltip(text, pos, opts = {}) {
  if (!text) return {};
  const props = { 'data-ui-tooltip': text, title: text };
  if (pos) props['data-ui-tooltip-pos'] = pos;
  if (opts.wrap) props['data-ui-tooltip-wrap'] = '';
  return props;
}
