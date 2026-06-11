/**
 * 조회용 장부 — GET: Blob 최신 스냅샷 / POST: 관리자 작성 시 덮어쓰기
 * 단일 파일(ledger/live-latest.json)로 Hobby Blob 1GB 한도·목록 1000건 제한 회피
 */
import { readFile } from 'fs/promises';
import path from 'path';

const LIVE_LATEST_PATH = 'ledger/live-latest.json';

const ALLOWED_HOST_RE =
  /^(https?:\/\/)?([^/]*\.)?(edu-team-tms|okestro-edu-team-tms)\.vercel\.app|localhost(:\d+)?/i;

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.tms_ledger_READ_WRITE_TOKEN;
}

function canPublish(req) {
  const secret = process.env.LEDGER_PUBLISH_SECRET;
  const key = req.headers['x-ledger-publish-key'];
  if (secret && key && key === secret) return true;

  const referer = req.headers.referer || req.headers.origin || '';
  return ALLOWED_HOST_RE.test(referer);
}

async function readStaticFromDisk() {
  const candidates = [
    path.join(process.cwd(), 'dist', 'ledger-snapshot.json'),
    path.join(process.cwd(), 'public', 'ledger-snapshot.json'),
  ];
  for (const filePath of candidates) {
    try {
      return JSON.parse(await readFile(filePath, 'utf8'));
    } catch {
      /* next */
    }
  }
  return null;
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

async function writeLiveBlob(payload) {
  const token = getBlobToken();
  if (!token) {
    const err = new Error('BLOB_READ_WRITE_TOKEN not set');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const { put } = await import('@vercel/blob');
  await put(LIVE_LATEST_PATH, JSON.stringify(payload), {
    access: 'public',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return LIVE_LATEST_PATH;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const live = await readLiveLatestBlob();
      if (live?.transactions) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Ledger-Source', 'blob-live');
        return res.status(200).json(live);
      }
      const data = await readStaticFromDisk();
      if (data?.transactions) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.setHeader('X-Ledger-Source', 'static');
        return res.status(200).json(data);
      }
      return res.status(404).json({ error: 'snapshot not found' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    if (!canPublish(req)) {
      return res.status(403).json({
        error: 'forbidden',
        message: '?mode=edit 관리자 URL에서만 조회용 장부를 갱신할 수 있습니다.',
      });
    }

    const body = req.body;
    if (!body || !Array.isArray(body.transactions)) {
      return res.status(400).json({ error: 'transactions 배열이 필요합니다.' });
    }

    const payload = {
      publishedAt: body.publishedAt || new Date().toISOString(),
      categories: body.categories ?? null,
      transactions: body.transactions,
      viewerMenuVisibility:
        body.viewerMenuVisibility && typeof body.viewerMenuVisibility === 'object'
          ? body.viewerMenuVisibility
          : undefined,
    };

    try {
      const pathname = await writeLiveBlob(payload);
      return res.status(200).json({ ok: true, publishedAt: payload.publishedAt, pathname });
    } catch (e) {
      if (e.code === 'NOT_CONFIGURED') {
        return res.status(501).json({
          error: 'server-publish-not-configured',
          message: 'Vercel Blob 연결 후 재배포가 필요합니다.',
        });
      }
      const msg = String(e.message || e);
      if (/quota|exceeded/i.test(msg)) {
        return res.status(507).json({
          error: 'blob-quota-exceeded',
          message:
            'Vercel Blob 저장 용량(1GB)이 가득 찼습니다. npm run prune:ledger-blobs 실행 또는 Storage에서 삭제 후 다시 시도하세요.',
        });
      }
      return res.status(500).json({ error: msg });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
