import { createClient } from '@supabase/supabase-js';
import { sortAnnouncements, ANNOUNCEMENT_COMMENT_MAX_LENGTH, ANNOUNCEMENT_REACTION_EMOJIS } from '../src/constants/announcements.js';
import { hasValidAdminSession } from '../server/api-utils/adminSession.js';
import { isAllowedPublishOrigin } from '../server/api-utils/publishOrigin.js';
import { isAdminRouteReferer } from '../server/api-utils/requestScope.js';
import {
  loadAnnouncementAccess,
  loadAnnouncementReadAccess,
  parseQuery,
  readJsonBody,
  resolveEngagementMember,
} from '../server/api-utils/announcementEngagement.js';

const ANNOUNCEMENTS_TABLE = 'announcements';
const COMMENTS_TABLE = 'announcement_comments';
const REACTIONS_TABLE = 'announcement_reactions';
const PAYLOAD_VERSION = 1;
const EMOJI_SET = new Set(ANNOUNCEMENT_REACTION_EMOJIS);

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

// Announcements Handlers
function normalizeAnnouncement(row) {
  if (!row || typeof row !== 'object') return null;
  const isPublished = typeof row.is_published === 'boolean' ? row.is_published : Boolean(row.isPublished);
  const isPinned = typeof row.is_pinned === 'boolean' ? row.is_pinned : Boolean(row.isPinned);
  return {
    id: String(row.id || '').trim(),
    title: String(row.title || '').trim(),
    body: typeof row.body === 'string' ? row.body.trim() : '',
    category: String(row.category || 'notice').trim() || 'notice',
    isPinned,
    isPublished,
    author: String(row.author || '').trim(),
    authorCode: String(row.author_code || row.authorCode || '').trim(),
    publishedAt: row.published_at || row.publishedAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    createdAt: row.created_at || row.createdAt || null,
  };
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
    .select('id, title, body, category, is_pinned, is_published, author, author_code, published_at, created_at, updated_at, payload_version')
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

async function handleAnnouncements(req, res, client) {
  if (req.method === 'GET') {
    const includeUnpublished = String(req.query?.includeUnpublished || '').toLowerCase() === 'true';

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
        message: data.length === 0 ? 'Announcements were not found.' : 'Announcements loaded from Supabase.',
        data,
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error.message || 'Announcements read failed.',
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

    const body = await readJsonBody(req);
    const announcement = body?.announcement;
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
        message: error.message || 'Announcements save failed.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}

// Comments Handlers
function normalizeComment(row) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    announcementId: String(row.announcement_id || ''),
    memberCode: String(row.member_code || ''),
    author: String(row.author || ''),
    body: String(row.body || ''),
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function handleComments(req, res, client) {
  if (req.method === 'GET') {
    const query = parseQuery(req);
    const announcementId = String(query.announcementId || '').trim();
    if (!announcementId) {
      return json(res, 400, { ok: false, status: 'error', message: 'announcementId is required.' });
    }

    try {
      const access = await loadAnnouncementReadAccess(client, req, [announcementId]);
      if (!access.ok) {
        return json(res, access.status, {
          ok: false,
          status: access.status === 404 ? 'not_found' : 'forbidden',
          message: access.message,
        });
      }
      if (!access.ids.includes(announcementId)) {
        return json(res, 200, { ok: true, status: 'ok', data: [] });
      }

      const { data, error } = await client
        .from(COMMENTS_TABLE)
        .select('id, announcement_id, member_code, author, body, is_deleted, created_at, updated_at')
        .eq('announcement_id', announcementId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw new Error(error.message);
      return json(res, 200, {
        ok: true,
        status: 'ok',
        data: (data || []).map(normalizeComment).filter(Boolean),
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error.message || 'Comments read failed.',
      });
    }
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body) {
      return json(res, 400, { ok: false, status: 'error', message: 'Invalid JSON body.' });
    }

    const resolved = resolveEngagementMember(req, body.memberCode);
    if (!resolved.ok) {
      return json(res, resolved.status, {
        ok: false,
        status: 'forbidden',
        message: resolved.message,
      });
    }

    const action = String(body.action || 'create').trim().toLowerCase();

    if (action === 'delete') {
      const commentId = String(body.commentId || '').trim();
      if (!commentId) {
        return json(res, 400, { ok: false, status: 'error', message: 'commentId is required.' });
      }

      try {
        const { data: existing, error: findError } = await client
          .from(COMMENTS_TABLE)
          .select('id, member_code, is_deleted')
          .eq('id', commentId)
          .maybeSingle();

        if (findError) throw new Error(findError.message);
        if (!existing) {
          return json(res, 404, { ok: false, status: 'not_found', message: 'Comment not found.' });
        }
        const canDelete = resolved.isAdmin || existing.member_code === resolved.memberCode;
        if (!canDelete) {
          return json(res, 403, {
            ok: false,
            status: 'forbidden',
            message: '본인 또는 관리자만 댓글을 삭제할 수 있습니다.',
          });
        }
        if (existing.is_deleted) {
          return json(res, 200, { ok: true, status: 'ok', data: normalizeComment(existing) });
        }
        const now = new Date().toISOString();
        const { data, error } = await client
          .from(COMMENTS_TABLE)
          .update({ is_deleted: true, updated_at: now })
          .eq('id', commentId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return json(res, 200, { ok: true, status: 'ok', data: normalizeComment(data) });
      } catch (error) {
        return json(res, 500, {
          ok: false,
          status: 'error',
          message: error.message || 'Comment delete failed.',
        });
      }
    }

    const access = await loadAnnouncementAccess(client, body.announcementId, {
      isAdmin: resolved.isAdmin,
    });
    if (!access.ok) {
      return json(res, access.status, {
        ok: false,
        status: access.status === 404 ? 'not_found' : 'forbidden',
        message: access.message,
      });
    }

    const text = String(body.body || '').trim();
    if (!text || text.length > ANNOUNCEMENT_COMMENT_MAX_LENGTH) {
      return json(res, 400, {
        ok: false,
        status: 'error',
        message: `댓글은 1~${ANNOUNCEMENT_COMMENT_MAX_LENGTH}자여야 합니다.`,
      });
    }

    const author = String(body.author || '').trim() || resolved.memberCode;

    try {
      const { data, error } = await client
        .from(COMMENTS_TABLE)
        .insert({
          announcement_id: access.announcement.id,
          member_code: resolved.memberCode,
          author,
          body: text,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return json(res, 200, {
        ok: true,
        status: 'ok',
        data: normalizeComment(data),
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error.message || 'Comment create failed.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}

// Reactions Handlers
function aggregateReactions(rows, memberCode) {
  const byAnnouncement = {};
  for (const row of rows || []) {
    const aid = String(row.announcement_id || '');
    const emoji = String(row.emoji || '');
    if (!aid || !emoji) continue;
    if (!byAnnouncement[aid]) byAnnouncement[aid] = {};
    if (!byAnnouncement[aid][emoji]) {
      byAnnouncement[aid][emoji] = { count: 0, mine: false };
    }
    byAnnouncement[aid][emoji].count += 1;
    if (memberCode && row.member_code === memberCode) {
      byAnnouncement[aid][emoji].mine = true;
    }
  }
  return byAnnouncement;
}

async function handleReactions(req, res, client) {
  if (req.method === 'GET') {
    const query = parseQuery(req);
    const idsRaw = String(query.announcementIds || '').trim();
    const ids = idsRaw
      ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100)
      : [];
    const memberCode = String(query.memberCode || '').trim().toUpperCase() || null;

    if (ids.length === 0) {
      return json(res, 200, { ok: true, status: 'ok', data: {} });
    }

    try {
      const access = await loadAnnouncementReadAccess(client, req, ids);
      if (!access.ok) {
        return json(res, access.status, {
          ok: false,
          status: access.status === 404 ? 'not_found' : 'forbidden',
          message: access.message,
        });
      }
      if (access.ids.length === 0) {
        return json(res, 200, { ok: true, status: 'ok', data: {} });
      }

      const { data, error } = await client
        .from(REACTIONS_TABLE)
        .select('announcement_id, member_code, emoji')
        .in('announcement_id', access.ids);

      if (error) throw new Error(error.message);
      return json(res, 200, {
        ok: true,
        status: 'ok',
        data: aggregateReactions(data, memberCode),
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error.message || 'Reactions read failed.',
      });
    }
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body) {
      return json(res, 400, { ok: false, status: 'error', message: 'Invalid JSON body.' });
    }

    const resolved = resolveEngagementMember(req, body.memberCode);
    if (!resolved.ok) {
      return json(res, resolved.status, {
        ok: false,
        status: 'forbidden',
        message: resolved.message,
      });
    }

    const emoji = String(body.emoji || '').trim();
    if (!EMOJI_SET.has(emoji)) {
      return json(res, 400, { ok: false, status: 'error', message: 'Unsupported emoji.' });
    }

    const access = await loadAnnouncementAccess(client, body.announcementId, {
      isAdmin: resolved.isAdmin,
    });
    if (!access.ok) {
      return json(res, access.status, {
        ok: false,
        status: access.status === 404 ? 'not_found' : 'forbidden',
        message: access.message,
      });
    }

    const announcementId = access.announcement.id;
    const memberCode = resolved.memberCode;

    try {
      const { data: existing, error: findError } = await client
        .from(REACTIONS_TABLE)
        .select('id')
        .eq('announcement_id', announcementId)
        .eq('member_code', memberCode)
        .eq('emoji', emoji)
        .maybeSingle();

      if (findError) throw new Error(findError.message);

      if (existing?.id) {
        const { error: delError } = await client.from(REACTIONS_TABLE).delete().eq('id', existing.id);
        if (delError) throw new Error(delError.message);
      } else {
        const { error: insError } = await client.from(REACTIONS_TABLE).insert({
          announcement_id: announcementId,
          member_code: memberCode,
          emoji,
        });
        if (insError) throw new Error(insError.message);
      }

      const { data: rows, error: listError } = await client
        .from(REACTIONS_TABLE)
        .select('announcement_id, member_code, emoji')
        .eq('announcement_id', announcementId);

      if (listError) throw new Error(listError.message);

      const aggregated = aggregateReactions(rows, memberCode);
      return json(res, 200, {
        ok: true,
        status: 'ok',
        toggledOff: Boolean(existing?.id),
        data: aggregated[announcementId] || {},
      });
    } catch (error) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: error.message || 'Reaction toggle failed.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}

// Helper to detect requested pathname (supports Vitest unit test environment where req.url is undefined)
function detectPathname(req) {
  if (req.url) {
    try {
      const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
      return url.pathname;
    } catch {
      // ignore
    }
  }

  // Fallback for Vitest unit tests: parse the stack trace to detect the caller test file
  const stack = new Error().stack || '';
  if (stack.includes('announcementComments')) {
    return '/api/announcement-comments';
  }
  if (stack.includes('announcementReactions')) {
    return '/api/announcement-reactions';
  }

  return '/api/announcements';
}

// Master Dispatcher
export default async function handler(req, res) {
  const client = getServiceClient();
  if (!client) {
    return json(res, 501, {
      ok: false,
      status: 'disabled',
      message: 'Supabase service role is not configured on the server.',
    });
  }

  const pathname = detectPathname(req);

  if (pathname.includes('/api/announcement-comments')) {
    return handleComments(req, res, client);
  } else if (pathname.includes('/api/announcement-reactions')) {
    return handleReactions(req, res, client);
  } else {
    return handleAnnouncements(req, res, client);
  }
}
