import { createClient } from '@supabase/supabase-js';
import { hasValidAdminSession } from './adminSession.js';
import { isAllowedPublishOrigin } from './publishOrigin.js';
import {
  isAdminOrSameMemberRouteReferer,
  isAdminRouteReferer,
} from './requestScope.js';

export const VALID_MEMBER_CODES = new Set(['A', 'B', 'C']);

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function getServiceClient(env = process.env) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function canUseEngagementOrigin(req) {
  const referer = req.headers.referer || req.headers.origin || '';
  return isAllowedPublishOrigin(referer);
}

/**
 * Member code from body/query must match URL scope.
 * /admin may only act as A after the password-backed session gate.
 * @returns {{ ok: true, memberCode: string, isAdmin: boolean } | { ok: false, status: number, message: string }}
 */
export function resolveEngagementMember(req, claimedCode) {
  const memberCode = String(claimedCode || '').trim().toUpperCase();
  if (!VALID_MEMBER_CODES.has(memberCode)) {
    return { ok: false, status: 400, message: 'memberCode must be A, B, or C.' };
  }
  if (!canUseEngagementOrigin(req)) {
    return { ok: false, status: 403, message: 'Forbidden origin.' };
  }
  const isAdmin = isAdminRouteReferer(req);
  if (isAdmin) {
    if (!hasValidAdminSession(req)) {
      return {
        ok: false,
        status: 403,
        message: '관리자 세션이 필요합니다. /admin 에서 비밀번호를 다시 입력하세요.',
      };
    }
    if (memberCode !== 'A') {
      return { ok: false, status: 403, message: '관리자 화면에서는 구성원 A로만 반응·댓글할 수 있습니다.' };
    }
    return { ok: true, memberCode: 'A', isAdmin: true };
  }
  if (!isAdminOrSameMemberRouteReferer(req, memberCode)) {
    return { ok: false, status: 403, message: '구성원 URL과 memberCode가 일치하지 않습니다.' };
  }
  return { ok: true, memberCode, isAdmin: false };
}

export async function loadAnnouncementAccess(client, announcementId, { isAdmin }) {
  const id = String(announcementId || '').trim();
  if (!id) {
    return { ok: false, status: 400, message: 'announcementId is required.' };
  }
  const { data, error } = await client
    .from('announcements')
    .select('id, is_published')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, message: error.message };
  }
  if (!data) {
    return { ok: false, status: 404, message: 'Announcement not found.' };
  }
  if (!isAdmin && !data.is_published) {
    return { ok: false, status: 403, message: '공개된 공지에만 반응·댓글할 수 있습니다.' };
  }
  return { ok: true, announcement: data };
}

/** Parse JSON body for Node/Vite handlers that may not pre-parse. */
export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  if (!req[Symbol.asyncIterator] && typeof req.on !== 'function') return null;

  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', resolve);
    req.on('error', reject);
  });
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}
