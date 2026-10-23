/**
 * 장부 API — Supabase 행 단위 쓰기(관리자 전용, service role).
 *
 * 장부는 Supabase(ledger_*)가 기준이다. 조회 화면은 anon 으로 Supabase 를 직접 읽고,
 * 이 엔드포인트는 `?resource=` 가 붙은 쓰기 요청만 처리한다(인증: 허용 origin + /admin referer + 관리자 세션,
 * 또는 서버 자동화용 `x-ledger-publish-key`).
 * Vercel Hobby 함수 개수 한도(12) 때문에 새 파일을 만들지 않고 이 엔드포인트에 라우팅한다.
 *
 * GET 은 더 이상 스냅샷을 서빙하지 않는다(옛 Blob 게시 경로 제거). 배포 스모크 체크와 헬스 체크가
 * 라우트 존재 여부로 쓰므로 `404 snapshot not found` 로 응답한다.
 */
import { createClient } from '@supabase/supabase-js';
import { hasValidAdminSession } from '../server/api-utils/adminSession.js';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';
import { isAdminRouteReferer } from '../server/api-utils/requestScope.js';
import {
  LedgerApiError,
  bulkUpsertTransactions,
  deleteTransaction,
  insertTransaction,
  putSetting,
  replaceCategories,
  updateTransaction,
} from '../server/api-utils/ledgerWriteCore.js';

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

export default async function handler(req, res) {
  const query = requestQuery(req);
  if (query.resource && req.method !== 'GET') {
    return handleLedgerWrite(req, res, String(query.resource), query);
  }

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({
      error: 'snapshot not found',
      message: '장부는 Supabase 로 이전되어 이 경로는 스냅샷을 제공하지 않습니다.',
    });
  }

  if (req.method === 'POST') {
    // 옛 Blob 게시(스냅샷 통째 덮어쓰기)는 제거됨. 행 단위 쓰기는 ?resource= 로 요청한다.
    return res.status(410).json({
      error: 'blob-publish-removed',
      message: 'Blob 게시는 제거되었습니다. 장부 변경은 관리자 화면에서 Supabase 에 바로 저장됩니다.',
    });
  }

  res.setHeader('Allow', 'GET, PATCH, PUT, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
