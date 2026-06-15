/**
 * Blob snapshot POST 허용 출처 — 새 Vercel 계정·프리뷰 URL 포함
 * @param {string} refererOrOrigin Referer 또는 Origin 헤더
 */
export function isAllowedPublishOrigin(refererOrOrigin = '') {
  const value = String(refererOrOrigin || '').trim();
  if (!value) return false;

  if (/^https?:\/\/localhost(:\d+)?/i.test(value)) return true;
  if (/^https?:\/\/[^/]+\.vercel\.app/i.test(value)) return true;
  if (/^https?:\/\/cxr542\.github\.io/i.test(value)) return true;

  const extra = String(process.env.TMS_PUBLISH_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return extra.some((origin) => value.startsWith(origin));
}
