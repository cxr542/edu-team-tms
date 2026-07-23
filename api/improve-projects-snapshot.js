import {
  buildImproveProjectsSnapshot,
  createEmptyImproveProjectsSnapshot,
  IMPROVE_PROJECTS_BLOB_KEY,
  normalizeImproveProjectsSnapshot,
  validateImproveProjectsPayload,
} from '../server/api-utils/improveProjectsSnapshotCore.js';
import { hasValidAdminSession } from '../server/api-utils/adminSession.js';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';
import { isAdminRouteReferer } from '../server/api-utils/requestScope.js';
import {
  assertBlobConfigured,
  getBlobSdkOptions,
  isBlobConfigured,
} from '../server/api-utils/blobClient.js';

function canUse(req) {
  const referer = req.headers.referer || req.headers.origin || '';
  return isAllowedPublishOrigin(referer);
}

function canPublish(req) {
  return canUse(req) && isAdminRouteReferer(req) && hasValidAdminSession(req);
}

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

async function fetchBlobJson(url) {
  if (!url) return null;
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function readLiveLatestBlob() {
  const blobOpts = getBlobSdkOptions();
  if (!blobOpts) return null;

  try {
    const { head } = await import('@vercel/blob');
    const meta = await head(IMPROVE_PROJECTS_BLOB_KEY, blobOpts);
    const raw = await fetchBlobJson(meta.downloadUrl || meta.url);
    if (!raw) return null;
    return normalizeImproveProjectsSnapshot(raw);
  } catch {
    return null;
  }
}

async function writeLiveBlob(payload) {
  assertBlobConfigured();
  const blobOpts = getBlobSdkOptions();

  const { put } = await import('@vercel/blob');
  await put(IMPROVE_PROJECTS_BLOB_KEY, JSON.stringify(payload), {
    access: 'public',
    ...blobOpts,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return IMPROVE_PROJECTS_BLOB_KEY;
}

function requestBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

function mapBlobError(e) {
  if (e.code === 'NOT_CONFIGURED') {
    return {
      status: 501,
      body: {
        error: 'server-publish-not-configured',
        message: 'Vercel Blob 연결 후 재배포가 필요합니다.',
      },
    };
  }
  const msg = String(e.message || e);
  if (/quota|exceeded/i.test(msg)) {
    return {
      status: 507,
      body: {
        error: 'blob-quota-exceeded',
        message: 'Vercel Blob 저장 용량이 가득 찼습니다. Storage 정리 후 다시 시도하세요.',
      },
    };
  }
  if (/429|rate limit|too many/i.test(msg)) {
    return {
      status: 429,
      body: {
        error: 'blob-rate-limited',
        message: 'Blob 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.',
      },
    };
  }
  return { status: 500, body: { error: msg } };
}

export default async function handler(req, res) {
  if (!canUse(req)) {
    return json(res, 403, { error: 'forbidden' });
  }

  if (req.method === 'GET') {
    try {
      if (!isBlobConfigured()) {
        const empty = createEmptyImproveProjectsSnapshot();
        return json(res, 200, empty, {
          'Cache-Control': 'no-store',
          'X-Improve-Projects-Source': 'disabled',
        });
      }
      const snapshot = await readLiveLatestBlob();
      if (!snapshot?.projects?.length) {
        const empty = createEmptyImproveProjectsSnapshot();
        return json(res, 200, empty, {
          'Cache-Control': 'no-store',
          'X-Improve-Projects-Source': 'empty',
        });
      }
      return json(res, 200, snapshot, {
        'Cache-Control': 'no-store',
        'X-Improve-Projects-Source': 'blob',
      });
    } catch (e) {
      return json(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST') {
    if (!canPublish(req)) {
      return json(res, 403, {
        error: 'forbidden',
        message: '관리자 세션이 있는 /admin URL에서만 향상 과제 팀 공유본을 저장할 수 있습니다.',
      });
    }

    try {
      const body = requestBody(req);
      const projects = Array.isArray(body?.projects) ? body.projects : null;
      if (!projects) {
        return json(res, 400, { error: 'projects 배열이 필요합니다.' });
      }
      const validation = validateImproveProjectsPayload(projects);
      if (!validation.ok) {
        return json(res, 400, { error: validation.error });
      }
      const publishedBy =
        typeof body?.meta?.publishedBy === 'string' ? body.meta.publishedBy : 'leader';
      const payload = buildImproveProjectsSnapshot(validation.projects, { publishedBy });
      const pathname = await writeLiveBlob(payload);
      return json(res, 200, {
        ok: true,
        pathname,
        snapshot: payload,
      });
    } catch (e) {
      const mapped = mapBlobError(e);
      return json(res, mapped.status, mapped.body);
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}
