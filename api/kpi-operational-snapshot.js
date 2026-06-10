import {
  createEmptyCompetencyCloudSnapshot,
  formatCompetencyCloudApiPayload,
  isCompetencyMonthRecordSaveable,
  isValidCompetencyMemberCode,
  isValidCompetencyYearMonth,
  mergeMemberIntoCompetencyCloudSnapshot,
  normalizeCompetencyCloudSnapshot,
} from '../src/utils/kpiOperationalCloudSnapshot.js';

const LIVE_LATEST_PATH = 'kpi-operational/live-latest.json';

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

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function fetchBlobJson(url) {
  if (!url) return null;
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

async function readLiveLatestBlob() {
  const token = getBlobToken();
  if (!token) return null;

  try {
    const { head } = await import('@vercel/blob');
    const meta = await head(LIVE_LATEST_PATH, { token });
    return fetchBlobJson(meta.downloadUrl || meta.url);
  } catch {
    return null;
  }
}

async function readLatestSnapshot() {
  const raw = await readLiveLatestBlob();
  if (!raw) return createEmptyCompetencyCloudSnapshot();
  return normalizeCompetencyCloudSnapshot(raw);
}

async function writeLiveBlob(payload) {
  const token = getBlobToken();
  if (!token) {
    const err = new Error('BLOB_READ_WRITE_TOKEN not set');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const { put } = await import('@vercel/blob');
  await put(LIVE_LATEST_PATH, JSON.stringify(formatCompetencyCloudApiPayload(payload)), {
    access: 'public',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return LIVE_LATEST_PATH;
}

function requestBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

export default async function handler(req, res) {
  if (!canUse(req)) {
    return json(res, 403, { error: 'forbidden' });
  }

  if (req.method === 'GET') {
    try {
      const snapshot = await readLatestSnapshot();
      res.setHeader('Cache-Control', 'no-store');
      return json(res, 200, formatCompetencyCloudApiPayload(snapshot));
    } catch (e) {
      return json(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = requestBody(req);
      const memberCode = body?.memberCode;
      const yearMonth = body?.yearMonth;
      const competencyMonth = body?.competencyMonth;

      if (!isValidCompetencyMemberCode(memberCode)) {
        return json(res, 400, { error: 'memberCode는 A/B/C 중 하나여야 합니다.' });
      }
      if (!isValidCompetencyYearMonth(yearMonth)) {
        return json(res, 400, { error: 'yearMonth는 YYYY-MM 형식이어야 합니다.' });
      }
      if (!competencyMonth || typeof competencyMonth !== 'object') {
        return json(res, 400, { error: 'competencyMonth 객체가 필요합니다.' });
      }
      if (!isCompetencyMonthRecordSaveable(competencyMonth, memberCode)) {
        return json(res, 400, { error: 'empty competency record' });
      }

      const updatedAt =
        typeof body.updatedAt === 'string' ? body.updatedAt : new Date().toISOString();
      const current = await readLatestSnapshot();
      const next = mergeMemberIntoCompetencyCloudSnapshot(
        current,
        memberCode,
        yearMonth,
        competencyMonth,
        { updatedAt }
      );
      const pathname = await writeLiveBlob(next);
      return json(res, 200, {
        ok: true,
        pathname,
        snapshot: formatCompetencyCloudApiPayload(next),
      });
    } catch (e) {
      if (e.code === 'NOT_CONFIGURED') {
        return json(res, 501, {
          error: 'server-publish-not-configured',
          message: 'Vercel Blob 연결 후 재배포가 필요합니다.',
        });
      }
      if (e.code === 'EMPTY_RECORD') {
        return json(res, 400, { error: 'empty competency record', message: e.message });
      }
      const msg = String(e.message || e);
      if (/quota|exceeded/i.test(msg)) {
        return json(res, 507, {
          error: 'blob-quota-exceeded',
          message: 'Vercel Blob 저장 용량이 가득 찼습니다. Storage 정리 후 다시 시도하세요.',
        });
      }
      return json(res, 500, { error: msg });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}
