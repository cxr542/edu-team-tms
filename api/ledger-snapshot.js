/**
 * 조회용 장부 — GET: Blob 최신 스냅샷 / POST: 관리자 작성 시 덮어쓰기
 * 단일 파일(ledger/live-latest.json)로 Hobby Blob 1GB 한도·목록 1000건 제한 회피
 *
 * `?resource=` 가 붙은 요청은 Supabase 행 단위 쓰기(관리자 전용, service role)이다.
 * Vercel Hobby 함수 개수 한도(12) 때문에 새 파일을 만들지 않고 이 엔드포인트에 라우팅한다.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { hasValidAdminSession } from '../server/api-utils/adminSession.js';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';
import { isAdminRouteReferer } from '../server/api-utils/requestScope.js';
import {
  assertBlobConfigured,
  getBlobSdkOptions,
  putWithRetry,
  headWithRetry,
} from '../server/api-utils/blobClient.js';

import {
  LedgerApiError,
  bulkUpsertTransactions,
  deleteTransaction,
  insertTransaction,
  putSetting,
  replaceCategories,
  updateTransaction,
} from '../server/api-utils/ledgerWriteCore.js';

const LIVE_LATEST_PATH = 'ledger/live-latest.json';

function getServiceClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function requestQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

/** 행 단위 쓰기 라우터. 인증 실패 403, 설정 누락 501, 검증 400, 충돌 409. */
async function handleLedgerWrite(req, res, resource, query) {
  if (!canPublish(req)) {
    return res.status(403).json({
      error: 'forbidden',
      message: '관리자 화면에서만 장부를 수정할 수 있습니다.',
    });
  }
  const client = getServiceClient();
  if (!client) {
    return res.status(501).json({ error: 'supabase-not-configured', message: 'Supabase 서버 설정이 필요합니다.' });
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const method = req.method;
  try {
    if (resource === 'transactions') {
      if (method === 'POST') return res.status(201).json({ ok: true, transaction: await insertTransaction(client, body.transaction) });
      if (method === 'PATCH') {
        const tx = await updateTransaction(client, String(query.id || ''), body.transaction, body.expectedVersion);
        return res.status(200).json({ ok: true, transaction: tx });
      }
      if (method === 'DELETE') {
        return res.status(200).json({ ok: true, ...(await deleteTransaction(client, String(query.id || ''), query.expectedVersion)) });
      }
    }
    if (resource === 'transactions-bulk' && method === 'POST') {
      const result = await bulkUpsertTransactions(client, body.transactions, {
        mode: body.mode,
        confirmReplace: body.confirmReplace,
      });
      return res.status(200).json({ ok: true, ...result });
    }
    if (resource === 'categories' && method === 'PUT') {
      return res.status(200).json({ ok: true, ...(await replaceCategories(client, body.categories)) });
    }
    if (resource === 'settings' && method === 'PUT') {
      return res.status(200).json({ ok: true, setting: await putSetting(client, body.key, body.value, body.expectedVersion) });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    if (e instanceof LedgerApiError) {
      return res.status(e.status).json({ error: e.code, message: e.message, ...e.extra });
    }
    return res.status(500).json({ error: 'internal-error', message: String(e?.message || e) });
  }
}

function canPublish(req) {
  const secret = process.env.LEDGER_PUBLISH_SECRET;
  const key = req.headers['x-ledger-publish-key'];
  if (secret && key && key === secret) return true;

  const referer = req.headers.referer || req.headers.origin || '';
  return isAllowedPublishOrigin(referer) && isAdminRouteReferer(req) && hasValidAdminSession(req);
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
  const blobOpts = getBlobSdkOptions();
  if (!blobOpts) return null;

  try {
    const meta = await headWithRetry(LIVE_LATEST_PATH, blobOpts);
    return fetchBlobJson(meta.downloadUrl || meta.url);
  } catch {
    return null;
  }
}

async function writeLiveBlob(payload) {
  assertBlobConfigured();
  const blobOpts = getBlobSdkOptions();

  await putWithRetry(LIVE_LATEST_PATH, JSON.stringify(payload), {
    access: 'public',
    ...blobOpts,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return LIVE_LATEST_PATH;
}

function pruneTransactions(transactions = []) {
  if (!Array.isArray(transactions)) return [];
  return transactions.map((tx) => {
    const next = { ...tx };
    if (next.extraData && typeof next.extraData === 'object' && Object.keys(next.extraData).length === 0) {
      delete next.extraData;
    }
    return next;
  });
}

export default async function handler(req, res) {
  const query = requestQuery(req);
  if (query.resource && req.method !== 'GET') {
    return handleLedgerWrite(req, res, String(query.resource), query);
  }

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
      transactions: pruneTransactions(body.transactions),
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

  res.setHeader('Allow', 'GET, POST, PATCH, PUT, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
