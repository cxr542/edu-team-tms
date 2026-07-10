import { readFile } from 'fs/promises';
import path from 'path';
import {
  isMemberJournalEmpty,
  isMemberJournalWriteStale,
  mergeMemberIntoJournalSnapshot,
  normalizeJournalCloudSnapshot,
} from '../src/utils/journalCloudSnapshot.js';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';
import { memberCodeFromReferer as memberCodeFromRequest } from '../server/api-utils/requestScope.js';
import {
  assertBlobConfigured,
  getBlobSdkOptions,
} from '../server/api-utils/blobClient.js';
import { isJournalBlobPostEnabled } from '../server/api-utils/journalBlobPost.js';
import { JOURNAL_BLOB_POST_DISABLED_MESSAGE } from '../src/constants/journalBlobShare.js';

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
  if (!res.ok) {
    const err = new Error(`Blob snapshot read failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return normalizeJournalCloudSnapshot(await res.json());
}

function isNotFoundError(e) {
  const status = Number(e?.status || e?.statusCode);
  return status === 404 || e?.code === 'BLOB_NOT_FOUND' || /not found|404/i.test(String(e?.message || e));
}

async function readLiveLatestBlob() {
  const blobOpts = getBlobSdkOptions();
  if (!blobOpts) return { configured: false, snapshot: null, unavailable: false };

  try {
    const { head } = await import('@vercel/blob');
    const meta = await head(LIVE_LATEST_PATH, blobOpts);
    return {
      configured: true,
      snapshot: await fetchBlobJson(meta.downloadUrl || meta.url),
      unavailable: false,
    };
  } catch (e) {
    return {
      configured: true,
      snapshot: null,
      unavailable: !isNotFoundError(e),
      error: e,
    };
  }
}

async function readLatestSnapshot({ failOnBlobReadError = false } = {}) {
  const blob = await readLiveLatestBlob();
  if (blob.snapshot) return { snapshot: blob.snapshot, source: 'blob' };
  if (blob.configured) {
    if (failOnBlobReadError && blob.unavailable) {
      const err = new Error('공유 일지 Blob을 읽지 못했습니다. 최신 원격본을 확인할 수 없어 저장을 중단합니다.');
      err.code = 'BLOB_READ_UNAVAILABLE';
      err.cause = blob.error;
      throw err;
    }
    return { snapshot: null, source: 'empty' };
  }
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
      const { snapshot, source } = await readLatestSnapshot({ failOnBlobReadError: true });
      if (!snapshot) return json(res, 404, { error: 'snapshot not found' });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('x-journal-source', source);
      return json(res, 200, snapshot);
    } catch (e) {
      if (e.code === 'BLOB_READ_UNAVAILABLE') {
        return json(res, 503, {
          error: 'blob-read-unavailable',
          message: e.message,
        });
      }
      return json(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST') {
    if (!isJournalBlobPostEnabled()) {
      return json(res, 501, {
        error: 'journal-blob-post-disabled',
        message: JOURNAL_BLOB_POST_DISABLED_MESSAGE,
      });
    }

    try {
      const body = requestBody(req);
      if (!body || !body.memberCode || !body.journal) {
        return json(res, 400, { error: 'memberCode와 journal이 필요합니다.' });
      }
      const routeMemberCode = memberCodeFromRequest(req);
      if (routeMemberCode !== body.memberCode) {
        return json(res, 403, {
          error: 'journal-member-forbidden',
          message: '현재 구성원 URL과 다른 일지는 팀 공유 저장할 수 없습니다.',
        });
      }

      if (isMemberJournalEmpty(body.journal)) {
        return json(res, 400, {
          error: 'journal-empty-payload',
          message: '빈 일지로는 팀 공유 저장소를 덮어쓸 수 없습니다.',
        });
      }

      const { snapshot: currentSnapshot } = await readLatestSnapshot({ failOnBlobReadError: true });
      const current = currentSnapshot || normalizeJournalCloudSnapshot({});
      const clientUpdatedAt =
        typeof body.updatedAt === 'string' ? body.updatedAt : null;
      if (isMemberJournalWriteStale(current, body.memberCode, clientUpdatedAt)) {
        return json(res, 409, {
          error: 'journal-write-conflict',
          message:
            '이 저널은 다른 곳에서 더 최신 내용으로 업데이트되었습니다. 최신 내용을 불러오거나 변경 내용을 확인한 뒤 다시 저장해 주세요.',
          snapshot: current,
        });
      }
      const updatedAt =
        typeof body.updatedAt === 'string' ? body.updatedAt : new Date().toISOString();
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
      if (e.code === 'BLOB_READ_UNAVAILABLE') {
        return json(res, 503, {
          error: 'blob-read-unavailable',
          message: e.message,
        });
      }
      return json(res, 500, { error: msg });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}
