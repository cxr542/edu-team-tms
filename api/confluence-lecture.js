/**
 * Confluence 강의일지 proxy — 토큰은 서버 환경변수만 사용
 * GET /api/confluence-lecture?action=list&parentId=&parentType=folder|page
 */
import {
  assertContentInLectureScope,
  fetchDirectChildren,
  resolveConfluenceConfig,
  sanitizeContentId,
} from '../server/api-utils/confluenceLecture.js';
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
 * @param {{
 *   env?: Record<string, string | undefined>,
 *   fetchImpl?: typeof fetch,
 * }} [options]
 */
export default async function handler(req, res, options = {}) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  if (!canUse(req)) {
    return json(res, 403, { error: 'Forbidden' });
  }

  const env = options.env || process.env;
  const config = resolveConfluenceConfig(env);
  if (!config.configured) {
    return json(res, 503, {
      available: false,
      message:
        'CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN 이 설정되지 않았습니다.',
      items: [],
    });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = (url.searchParams.get('action') || 'list').trim().toLowerCase();
  if (action !== 'list') {
    return json(res, 400, { error: 'Unsupported action', available: false, items: [] });
  }

  const rawParentId = url.searchParams.get('parentId');
  const requestedId = sanitizeContentId(rawParentId);
  if (rawParentId != null && String(rawParentId).trim() !== '' && !requestedId) {
    return json(res, 400, { error: 'Invalid parentId', available: false, items: [] });
  }
  const parentId = requestedId || config.folderId;
  const rawType = (url.searchParams.get('parentType') || '').trim().toLowerCase();
  const parentType =
    rawType === 'page' || rawType === 'folder'
      ? rawType
      : requestedId
        ? 'folder'
        : config.parentType;
  const fetchImpl = options.fetchImpl || fetch;

  try {
    if (requestedId) {
      await assertContentInLectureScope({
        config,
        parentId,
        parentType,
        fetchImpl,
      });
    }
    const listed = await fetchDirectChildren({
      config,
      parentId,
      parentType,
      fetchImpl,
    });
    return json(res, 200, {
      available: true,
      rootFolderId: config.folderId,
      spaceKey: config.spaceKey,
      baseUrl: config.baseUrl,
      ...listed,
    });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status === 400) {
      return json(res, 400, { error: e.message || 'Bad request', available: false, items: [] });
    }
    return json(res, status >= 400 && status < 600 ? status : 500, {
      available: false,
      error: e.message || 'Proxy error',
      items: [],
    });
  }
}
