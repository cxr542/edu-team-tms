/** ppt-academizer — 운영 API Netlify 고정 (sync-ppt-academizer.mjs) */

export function academizerEmbedPath() {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}tools/ppt-academizer/index.html`;
}

export function buildAcademizerModuleUrl({ mode = 'edit' } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  url.searchParams.set('module', 'academizer');
  return `${url.pathname}${url.search}`;
}
