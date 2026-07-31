/**
 * Resolve ppt-academizer FastAPI upstream for TMS health proxy.
 * Uploads go browser → API directly (CORS); Vercel cannot proxy 50MB bodies.
 */

const DEFAULT_LOCAL = 'http://127.0.0.1:8766';

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ configured: boolean, apiBase: string, message?: string }}
 */
export function resolveAcademizerUpstream(env = process.env) {
  const raw =
    String(env.PPT_ACADEMIZER_API_URL || env.VITE_PPT_ACADEMIZER_API_URL || '').trim() ||
    (env.NODE_ENV !== 'production' ? DEFAULT_LOCAL : '');
  const apiBase = raw.replace(/\/$/, '');
  if (!apiBase) {
    return {
      configured: false,
      apiBase: '',
      message:
        'PPT_ACADEMIZER_API_URL 이 설정되지 않았습니다. Render(또는 로컬) FastAPI URL을 넣으세요.',
    };
  }
  return { configured: true, apiBase };
}
