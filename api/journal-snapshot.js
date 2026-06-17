import { readFile } from 'fs/promises';
import path from 'path';
import {
  isJournalMemberUpdateStale,
  mergeMemberIntoJournalSnapshot,
  normalizeJournalCloudSnapshot,
} from '../src/utils/journalCloudSnapshot.js';
import { isAllowedPublishOrigin } from './utils/publishOrigin.js';
import {
  assertBlobConfigured,
  getBlobSdkOptions,
} from './utils/blobClient.js';

const LIVE_LATEST_PATH = 'journal/live-latest.json';

function canUse(req) {
  const referer = req.headers.referer || req.headers.origin || '';
  return isAllowedPublishOrigin(referer);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readStaticFromDisk() {
  const candidates = [
    path.join(process.cwd(), 'dist', 'journal-snapshot.json'),
    path.join(process.cwd(), 'public', 'journal-snapshot.json'),
  ];
  for (const filePath of candidates) {
    try {
      return normalizeJournalCloudSnapshot(JSON.parse(await readFile(filePath, 'utf8')));
    } catch {
      continue;
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
  return normalizeJournalCloudSnapshot(await res.json());
}

async function readLiveLatestBlob() {
  const blobOpts = getBlobSdkOptions();
  if (!blobOpts) return null;

  try {
    const { head } = await import('@vercel/blob');
    const meta = await head(LIVE_LATEST_PATH, blobOpts);
    return fetchBlobJson(meta.downloadUrl || meta.url);
  } catch {
    return null;
  }
}

async function readLatestSnapshot() {
  const blob = await readLiveLatestBlob();
  if (blob) return { snapshot: blob, source: 'blob' };
  const disk = await readStaticFromDisk();
  if (disk) return { snapshot: disk, source: 'static' };
  return { snapshot: null, source: 'empty' };
}

async function writeLiveBlob(payload) {
  assertBlobConfigured();
  const blobOpts = getBlobSdkOptions();

  const { put } = await import('@vercel/blob');
  await put(LIVE_LATEST_PATH, JSON.stringify(payload), {
    access: 'public',
    ...blobOpts,
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
      const { snapshot, source } = await readLatestSnapshot();
      if (!snapshot) return json(res, 404, { error: 'snapshot not found' });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('x-journal-source', source);
      return json(res, 200, snapshot);
    } catch (e) {
      return json(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = requestBody(req);
      if (!body || !body.memberCode || !body.journal) {
        return json(res, 400, { error: 'memberCode와 journal이 필요합니다.' });
      }

      const { snapshot: currentSnapshot } = await readLatestSnapshot();
      const current = currentSnapshot || normalizeJournalCloudSnapshot({});
      const updatedAt =
        typeof body.updatedAt === 'string' ? body.updatedAt : new Date().toISOString();
      if (isJournalMemberUpdateStale(current, body.memberCode, updatedAt)) {
        const currentUpdatedAt = current.meta?.memberUpdatedAt?.[body.memberCode] || current.meta?.updatedAt;
        return json(res, 409, {
          error: 'stale-member-snapshot',
          message: '이미 더 최신 공유 일지가 있습니다. 팀 공유본을 먼저 확인한 뒤 다시 저장하세요.',
          currentUpdatedAt,
        });
      }
      const next = mergeMemberIntoJournalSnapshot(current, body.memberCode, body.journal, {
        updatedAt,
      });
      const pathname = await writeLiveBlob(next);
      return json(res, 200, { ok: true, pathname, snapshot: next });
    } catch (e) {
      if (e.code === 'NOT_CONFIGURED') {
        return json(res, 501, {
          error: 'server-publish-not-configured',
          message: 'Vercel Blob 연결 후 재배포가 필요합니다.',
        });
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
