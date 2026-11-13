/**
 * 사이드바 메뉴 이름·순서의 팀 공유 설정 (service role). 관리자 세션이 있어야 읽고 쓴다.
 *  - GET  : 저장된 설정 {order, labels} 와 마지막 저장 시각. 없으면 status 'empty'
 *  - PUT / POST {value:{order, labels}} : 설정을 통째로 저장 (key='nav-menu' 한 행, 마지막 저장이 이긴다)
 * 테이블(nav_settings)이 아직 없으면 503 'not-ready' 로 알려 준다 (supabase/nav-settings.sql).
 */
import { canUseAdminWrite } from './adminWriteGuard.js';
import { readJsonBody } from './announcementEngagement.js';
import { sanitizeNavSettings } from '../../src/utils/navOrder.js';

const TABLE = 'nav_settings';
const KEY = 'nav-menu';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function isTableMissing(error) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return /42P01|PGRST205|does not exist|schema cache/i.test(text);
}

function dbError(res, error) {
  if (isTableMissing(error)) {
    return json(res, 503, {
      ok: false,
      status: 'not-ready',
      message: '공유 저장소(nav_settings 테이블)가 아직 준비되지 않았습니다.',
    });
  }
  return json(res, 500, { ok: false, status: 'error', message: error?.message || '저장소 오류' });
}

export async function handleNavSettings(req, res, client) {
  if (!canUseAdminWrite(req)) {
    return json(res, 403, { ok: false, status: 'forbidden', message: '관리자 화면에서만 메뉴 설정을 보고 바꿀 수 있습니다.' });
  }

  if (req.method === 'GET') {
    const { data, error } = await client.from(TABLE).select('value, updated_at').eq('key', KEY);
    if (error) return dbError(res, error);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return json(res, 200, { ok: true, status: 'empty', data: null });
    return json(res, 200, {
      ok: true,
      status: 'ok',
      data: { value: sanitizeNavSettings(row.value), updatedAt: row.updated_at || null },
    });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object' || body.value == null || typeof body.value !== 'object') {
      return json(res, 400, { ok: false, status: 'error', message: 'value 가 필요합니다.' });
    }
    const value = sanitizeNavSettings(body.value);
    const updatedAt = new Date().toISOString();
    const { error } = await client.from(TABLE).upsert([{ key: KEY, value, updated_at: updatedAt }], { onConflict: 'key' });
    if (error) return dbError(res, error);
    return json(res, 200, { ok: true, status: 'ok', data: { value, updatedAt } });
  }

  res.setHeader('Allow', 'GET, PUT, POST');
  return json(res, 405, { ok: false, status: 'error', message: 'Method not allowed' });
}
