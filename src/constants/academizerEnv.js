/** ppt-academizer — TMS native page; API via PPT_ACADEMIZER_API_URL (Render/local). */

export function buildAcademizerModuleUrl({ mode = 'edit' } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  url.searchParams.set('module', 'academizer');
  return `${url.pathname}${url.search}`;
}
