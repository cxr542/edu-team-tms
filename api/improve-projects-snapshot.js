import {
  buildImproveProjectsSnapshot,
  createEmptyImproveProjectsSnapshot,
  IMPROVE_PROJECTS_LIVE_PATH,
  normalizeImproveProjectsSnapshot,
  validateImproveProjectsPayload,
} from '../src/utils/improveProjectsCloudSnapshot.js';

const ALLOWED_HOST_RE =
  /^(https?:\/\/)?([^/]*\.)?(edu-team-tms|okestro-edu-team-tms)\.vercel\.app|localhost(:\d+)?/i;

function getBlobToken() {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.tms_journal_READ_WRITE_TOKEN ||
    process.env.tms_ledger_READ_WRITE_TOKEN
  );
}

function canUse(req) {
  const referer = req.headers.referer || req.headers.origin || '';
  return ALLOWED_HOST_RE.test(referer);
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
  const token = getBlobToken();
  if (!token) return null;

  try {
    const { head } = await import('@vercel/blob');
    const meta = await head(IMPROVE_PROJECTS_LIVE_PATH, { token });
    const raw = await fetchBlobJson(meta.downloadUrl || meta.url);
    if (!raw) return null;
    return normalizeImproveProjectsSnapshot(raw);
  } catch {
    return null;
  }
}

async function writeLiveBlob(payload) {
  const token = getBlobToken();
  if (!token) {
    const err = new Error('BLOB_READ_WRITE_TOKEN not set');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const { put } = await import('@vercel/blob');
  await put(IMPROVE_PROJECTS_LIVE_PATH, JSON.stringify(payload), {
    access: 'public',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return IMPROVE_PROJECTS_LIVE_PATH;
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
      const token = getBlobToken();
      if (!token) {
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
    try {
      const body = requestBody(req);
      const projects = Array.isArray(body?.projects) ? body.projects : body;
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
