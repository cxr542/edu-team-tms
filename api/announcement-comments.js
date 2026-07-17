/**
 * Announcement comments — service-role + referer member scope.
 * GET    /api/announcement-comments?announcementId=
 * POST   create { announcementId, memberCode, author, body }
 * POST   soft-delete { action: 'delete', commentId, memberCode }
 */
import { ANNOUNCEMENT_COMMENT_MAX_LENGTH } from '../src/constants/announcements.js';
import {
  getServiceClient,
  json,
  loadAnnouncementAccess,
  loadAnnouncementReadAccess,
  parseQuery,
  readJsonBody,
  resolveEngagementMember,
} from '../server/api-utils/announcementEngagement.js';

const TABLE = 'announcement_comments';

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
    const query = parseQuery(req);
    const announcementId = String(query.announcementId || '').trim();
    if (!announcementId) {
      return json(res, 400, {
        ok: false,
        status: 'error',
        message: 'announcementId is required.',
      });
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
        .from(TABLE)
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
        message: error instanceof Error ? error.message : 'Comments read failed.',
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
        return json(res, 400, {
          ok: false,
          status: 'error',
          message: 'commentId is required.',
        });
      }

      try {
        const { data: existing, error: findError } = await client
          .from(TABLE)
          .select('id, member_code, is_deleted')
          .eq('id', commentId)
          .maybeSingle();
        if (findError) throw new Error(findError.message);
        if (!existing) {
          return json(res, 404, { ok: false, status: 'not_found', message: 'Comment not found.' });
        }
        const canDelete =
          resolved.isAdmin || existing.member_code === resolved.memberCode;
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
          .from(TABLE)
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
          message: error instanceof Error ? error.message : 'Comment delete failed.',
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
        .from(TABLE)
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
        message: error instanceof Error ? error.message : 'Comment create failed.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}
