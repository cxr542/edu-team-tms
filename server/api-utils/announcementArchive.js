/**
 * 공지 보관 처리 (service role). 관리자 세션이 있어야 한다.
 *  - GET                          : 미리보기. 보관 대상 공지 목록만 돌려준다(아무것도 바꾸지 않음). 릴리즈노트 분류·고정 공지는 제외.
 *  - POST {action:'archive', ids} : ids 중 지금도 대상인 공지를 게시 해제한다(삭제 아님).
 *  - POST {action:'restore', ids} : ids 중 게시 해제된(게시 이력이 있는) 공지를 다시 게시한다.
 * 쓰기는 is_published 한 칸뿐이다. 서버가 조건을 다시 확인하므로 미리보기 이후 바뀐 공지는 건드리지 않는다.
 */
import { canUseAdminWrite } from './adminWriteGuard.js';
import { readJsonBody } from './announcementEngagement.js';
import {
  ARCHIVE_AFTER_DAYS,
  ARCHIVE_MAX_IDS,
  archiveCutoffIso,
  isArchiveCandidate,
  isRestorable,
  sanitizeIds,
} from '../../src/utils/announcementArchive.js';

const TABLE = 'announcements';
const COLUMNS = 'id, title, category, is_pinned, is_published, published_at';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function dbError(res, error) {
  return json(res, 500, { ok: false, status: 'error', message: error?.message || '저장소 오류' });
}

const toItem = (row) => ({
  id: row.id,
  title: row.title,
  category: row.category,
  publishedAt: row.published_at,
});

export async function handleAnnouncementArchive(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return json(res, 403, { ok: false, status: 'forbidden', message: '관리자 화면에서만 공지를 정리할 수 있습니다.' });
  }

  const now = new Date();

  if (req.method === 'GET') {
    const { data, error } = await client
      .from(TABLE)
      .select(COLUMNS)
      .eq('is_published', true)
      .eq('is_pinned', false)
      .neq('category', 'release')
      .lt('published_at', archiveCutoffIso(now))
      .order('published_at', { ascending: true })
      .limit(ARCHIVE_MAX_IDS);
    if (error) return dbError(res, error);
    const items = (data || []).filter((row) => isArchiveCandidate(row, now)).map(toItem);
    return json(res, 200, {
      ok: true,
      status: 'ok',
      data: { days: ARCHIVE_AFTER_DAYS, items, truncated: items.length >= ARCHIVE_MAX_IDS },
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, status: 'error', message: 'method not allowed' });
  }

  const body = await readJsonBody(req);
  const ids = sanitizeIds(body?.ids);
  if (!ids || (body?.action !== 'archive' && body?.action !== 'restore')) {
    return json(res, 400, {
      ok: false,
      status: 'error',
      message: `action(archive|restore)과 ids(1~${ARCHIVE_MAX_IDS}건)가 필요합니다.`,
    });
  }

  const { data: found, error: findError } = await client.from(TABLE).select(COLUMNS).in('id', ids);
  if (findError) return dbError(res, findError);

  const eligible = (found || []).filter((row) =>
    body.action === 'archive' ? isArchiveCandidate(row, now) : isRestorable(row),
  );
  const eligibleIds = eligible.map((row) => row.id);
  if (eligibleIds.length === 0) {
    return json(res, 200, { ok: true, status: 'ok', data: { changedIds: [], skipped: ids.length } });
  }

  const publish = body.action === 'restore';
  const { data: updated, error: updateError } = await client
    .from(TABLE)
    .update({ is_published: publish })
    .in('id', eligibleIds)
    .eq('is_published', !publish)
    .select('id');
  if (updateError) return dbError(res, updateError);

  const changedIds = (updated || []).map((row) => row.id);
  return json(res, 200, {
    ok: true,
    status: 'ok',
    data: { changedIds, skipped: ids.length - changedIds.length },
  });
}
