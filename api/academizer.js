/**
 * PPT Academizer health proxy — large uploads must hit the upstream API directly (CORS).
 * GET /api/academizer?action=health
 */
import { resolveAcademizerUpstream } from '../server/api-utils/academizerUpstream.js';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';

function canUse(req) {
  const referer = req.headers.referer || req.headers.origin || '';
  return isAllowedPublishOrigin(referer);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{ env?: Record<string, string | undefined>, fetchImpl?: typeof fetch }} [options]
 */
export default async function handler(req, res, options = {}) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed', available: false });
  }
  if (!canUse(req)) {
    return json(res, 403, { error: 'Forbidden', available: false });
  }

  const env = options.env || process.env;
  const upstream = resolveAcademizerUpstream(env);
  if (!upstream.configured) {
    return json(res, 503, {
      available: false,
      configured: false,
      apiBase: '',
      message: upstream.message,
    });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = (url.searchParams.get('action') || 'health').trim().toLowerCase();
  if (action !== 'health') {
    return json(res, 400, {
      error: 'Unsupported action',
      available: false,
      configured: true,
      apiBase: upstream.apiBase,
    });
  }

  const fetchImpl = options.fetchImpl || fetch;
  try {
    const upstreamRes = await fetchImpl(`${upstream.apiBase}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    let data = null;
    try {
      data = await upstreamRes.json();
    } catch {
      data = null;
    }
    if (!upstreamRes.ok) {
      return json(res, 502, {
        available: false,
        configured: true,
        apiBase: upstream.apiBase,
        message:
          (data && (data.detail || data.message || data.error)) ||
          `변환 API 응답 오류 (${upstreamRes.status})`,
        upstreamStatus: upstreamRes.status,
      });
    }
    const templateOk = data?.template_configured !== false;
    return json(res, 200, {
      available: !!(data?.ok && templateOk),
      configured: true,
      apiBase: upstream.apiBase,
      message: templateOk
        ? undefined
        : '변환 API는 응답하지만 TEMPLATE_PPTX(아카데미 템플릿)가 설정되지 않았습니다.',
      health: data || {},
    });
  } catch (err) {
    return json(res, 502, {
      available: false,
      configured: true,
      apiBase: upstream.apiBase,
      message: err?.message || String(err) || '변환 API에 연결할 수 없습니다.',
    });
  }
}
