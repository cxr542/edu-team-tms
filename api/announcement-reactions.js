/**
 * Announcement emoji reactions — service-role + referer member scope.
 * GET  /api/announcement-reactions?announcementIds=&memberCode=
 * POST /api/announcement-reactions { announcementId, memberCode, emoji }
 */
import { ANNOUNCEMENT_REACTION_EMOJIS } from '../src/constants/announcements.js';
import {
  getServiceClient,
  json,
  loadAnnouncementAccess,
  loadAnnouncementReadAccess,
  parseQuery,
  readJsonBody,
  resolveEngagementMember,
} from '../server/api-utils/announcementEngagement.js';

const TABLE = 'announcement_reactions';
const EMOJI_SET = new Set(ANNOUNCEMENT_REACTION_EMOJIS);

function aggregateReactions(rows, memberCode) {
  /** @type {Record<string, Record<string, { count: number, mine: boolean }>>} */
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
        .from(TABLE)
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
        message: error instanceof Error ? error.message : 'Reactions read failed.',
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
      return json(res, 400, {
        ok: false,
        status: 'error',
        message: 'Unsupported emoji.',
      });
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
        .from(TABLE)
        .select('id')
        .eq('announcement_id', announcementId)
        .eq('member_code', memberCode)
        .eq('emoji', emoji)
        .maybeSingle();
      if (findError) throw new Error(findError.message);

      if (existing?.id) {
        const { error: delError } = await client.from(TABLE).delete().eq('id', existing.id);
        if (delError) throw new Error(delError.message);
      } else {
        const { error: insError } = await client.from(TABLE).insert({
          announcement_id: announcementId,
          member_code: memberCode,
          emoji,
        });
        if (insError) throw new Error(insError.message);
      }

      const { data: rows, error: listError } = await client
        .from(TABLE)
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
        message: error instanceof Error ? error.message : 'Reaction toggle failed.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'method not allowed' });
}
