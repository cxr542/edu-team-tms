const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://edu-team-tms-ten.vercel.app',
  'https://okestro-edu-team-tms.vercel.app',
  'https://edu-team-tms.vercel.app',
  'https://cxr542.github.io',
]);

function parseOrigin(value) {
  try {
    return new URL(String(value || '').trim()).origin;
  } catch {
    return '';
  }
}

function configuredAllowedOrigins() {
  return String(process.env.TMS_PUBLISH_ALLOWED_ORIGINS || '')
    .split(',')
    .map(parseOrigin)
    .filter(Boolean);
}

/**
 * Blob snapshot POST 허용 출처.
 * Referer/Origin 헤더는 인증 수단이 아니므로 임의의 Vercel hostname을 신뢰하지 않는다.
 * 새 운영/프리뷰 origin은 TMS_PUBLISH_ALLOWED_ORIGINS에 명시적으로 추가한다.
 *
 * @param {string} refererOrOrigin Referer 또는 Origin 헤더
 */
export function isAllowedPublishOrigin(refererOrOrigin = '') {
  const origin = parseOrigin(refererOrOrigin);
  if (!origin) return false;

  if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin)) return true;
  if (DEFAULT_ALLOWED_ORIGINS.has(origin)) return true;

  return configuredAllowedOrigins().includes(origin);
}
