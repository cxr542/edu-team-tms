import { createClient } from '@supabase/supabase-js';
import { sortAnnouncements } from '../src/constants/announcements.js';
import { normalizeAnnouncement } from '../src/utils/announcementsSupabase.js';
import { hasValidAdminSession } from './utils/adminSession.js';
import { isAllowedPublishOrigin } from './utils/publishOrigin.js';
import { isAdminRouteReferer } from './utils/requestScope.js';

const ANNOUNCEMENTS_TABLE = 'announcements';
const PAYLOAD_VERSION = 1;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getServiceClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function canUseAdminWrite(req) {
  const referer = req.headers.referer || req.headers.origin || '';
  if (!isAllowedPublishOrigin(referer)) return false;
  if (!isAdminRouteReferer(req)) return false;
  return hasValidAdminSession(req);
}

function toRowPayload(announcement) {
  const normalized = normalizeAnnouncement(announcement);
  if (!normalized) return null;

  const now = new Date().toISOString();
  const publishedAt = normalized.isPublished
    ? normalized.publishedAt || now
    : normalized.publishedAt || null;

  return {
    id: normalized.id,
    title: normalized.title,
    body: normalized.body,
    category: normalized.category,
    is_pinned: Boolean(normalized.isPinned),
    is_published: Boolean(normalized.isPublished),
    author: normalized.author,
    author_code: normalized.authorCode,
    published_at: publishedAt,
    created_at: normalized.createdAt || now,
    updated_at: now,
    payload_version: PAYLOAD_VERSION,
  };
}

async function listAnnouncements(client, { includeUnpublished = false } = {}) {
  let query = client
    .from(ANNOUNCEMENTS_TABLE)
    .select(
      'id, title, body, category, is_pinned, is_published, author, author_code, published_at, created_at, updated_at, payload_version'
    )
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (!includeUnpublished) {
    query = query.eq('is_published', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const normalized = (data || []).map(normalizeAnnouncement).filter(Boolean);
  return sortAnnouncements(normalized);
}

export default async function handler(req, res) {
  const client = getServiceClient();
  if (!client) {
    return json(res, 501, {
      ok: false,
      status: 'disabled',
      message: 'Supabase service role is not configured on the server.',
    });
  }

  if (req.method === 'GET') {
    const includeUnpublished =
      String(req.query?.includeUnpublished || '').toLowerCase() === 'true';

    if (includeUnpublished && !canUseAdminWrite(req)) {
      return json(res, 403, {
        ok: false,
        status: 'forbidden',
        message: '관리자 세션이 필요합니다. /admin 에서 비밀번호를 다시 입력하세요.',
      });
    }

    try {
      const data = await listAnnouncements(client, { includeUnpublished });
      return json(res, 200, {
        ok: true,
        status: data.length === 0 ? 'empty' : 'ok',
        message:
          data.length === 0
            ? 'Announcements were not found.'
            : 'Announcements loaded from Supabase.',
        data,
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Announcements read failed.',
      });
    }
  }

  if (req.method === 'POST') {
    if (!canUseAdminWrite(req)) {
      return json(res, 403, {
        ok: false,
        status: 'forbidden',
        message: '관리자 세션이 필요합니다. /admin 에서 비밀번호를 다시 입력하세요.',
      });
    }

    const announcement = req.body?.announcement;
    const row = toRowPayload(announcement);
    if (!row) {
      return json(res, 400, {
        ok: false,
        status: 'error',
        message: 'announcement payload is invalid.',
      });
    }

    try {
      const { data, error } = await client
        .from(ANNOUNCEMENTS_TABLE)
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        return json(res, 500, {
          ok: false,
          status: 'error',
          message: error.message,
        });
      }

      return json(res, 200, {
        ok: true,
        status: 'ok',
        message: 'Announcement saved to Supabase.',
        data: normalizeAnnouncement(data),
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Announcements save failed.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}
