/** @typedef {{ id: string, text: string, level: number }} DocHeading */

export function slugifyHeading(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\u3131-\uD79D\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** DOM에서 heading id 부여 후 목차 추출 */
export function enrichArticleHeadings(root) {
  /** @type {DocHeading[]} */
  const headings = [];
  root.querySelectorAll('h1, h2, h3, h4').forEach((el) => {
    const level = Number(el.tagName.slice(1));
    const text = (el.textContent || '').trim();
    if (!text) return;
    let id = el.id || slugifyHeading(text);
    let n = 2;
    while (id && root.querySelector(`#${CSS.escape(id)}`) && root.querySelector(`#${CSS.escape(id)}`) !== el) {
      id = `${slugifyHeading(text)}-${n++}`;
    }
    el.id = id;
    if (level >= 2 && level <= 4) {
      headings.push({ id, text, level });
    }
  });
  return headings;
}

export function scrollToDocHeading(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
