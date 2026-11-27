/**
 * 오늘 뭐 먹지 — 팀이 함께 쓰는 식당 목록 (service role, 테이블 lunch_spots).
 *
 * - GET            모든 구성원·관리자: 팀 식당 목록
 * - POST           구성원·관리자: 식당 추가(이름이 같은 식당이 있으면 409)
 * - PATCH ?id=     등록한 구성원 또는 관리자: 식당 정보 수정
 * - DELETE ?id=    등록한 구성원 또는 관리자: 식당 삭제
 *
 * 구성원은 Referer 주소(/yhkim, /wschoi, /hyshin)로, 관리자는 /admin 주소 + 관리자 세션으로 정한다.
 * Origin/Referer 는 인증이 아니다. 점심 식당 목록이라 이 약한 검사로 충분하다고 본다.
 */
import { hasValidAdminSession } from './adminSession.js';
import { readJsonBody } from './announcementEngagement.js';
import { isAllowedPublishOrigin } from './publishOrigin.js';
import { isAdminRouteReferer, memberCodeFromReferer } from './requestScope.js';

export const LUNCH_SPOTS_TABLE = 'lunch_spots';
const COLUMNS = 'id, name, data, created_by, created_at, updated_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function fail(res, status, code, message, extra = {}) {
  return json(res, status, { ok: false, status: code, message, ...extra });
}

function dbFailed(res, action, error) {
  console.error(`[lunch-spots] ${action} failed:`, error?.message || error);
  return fail(res, 500, 'error', '식당 목록을 처리하지 못했습니다.');
}

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const normalizeName = (name) => String(name || '').replace(/\s+/g, '').toLowerCase();

function textList(v, maxItems, maxLen) {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,，]/) : [];
  return [...new Set(list.map((x) => text(x, maxLen)).filter(Boolean))].slice(0, maxItems);
}

/** 화면에서 온 식당 정보를 저장할 값만 골라 검사한다. 이름이 없으면 null. */
export function sanitizeSpotInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const name = text(body.name, 80);
  if (!name) return null;
  const mapUrl = text(body.mapUrl, 500);
  const menus = (Array.isArray(body.menus) ? body.menus : [])
    .map((m) => {
      const menuName = text(m?.name, 40);
      const price = Number(m?.priceWon);
      if (!menuName) return null;
      return Number.isFinite(price) && price >= 0 && price <= 1000000
        ? { name: menuName, priceWon: Math.round(price) }
        : { name: menuName };
    })
    .filter(Boolean)
    .slice(0, 5);
  const priceLevel = Number(body.priceLevel);
  const walk = Number(body.walkMinutes);
  const weight = Number(body.weight);
  return {
    name,
    data: {
      category: text(body.category, 40) || '기타',
      priceLevel: [0, 1, 2].includes(priceLevel) ? priceLevel : 0,
      walkMinutes: Number.isFinite(walk) ? Math.min(120, Math.max(1, Math.round(walk))) : 5,
      exitHint: text(body.exitHint, 200),
      tags: textList(body.tags, 10, 30),
      menuHints: textList(body.menuHints, 10, 40),
      ...(menus.length ? { menus } : {}),
      mapUrl: /^https?:\/\//i.test(mapUrl) ? mapUrl : '',
      teamNote: text(body.teamNote, 200),
      weight: Number.isFinite(weight) && weight > 0 ? Math.min(5, weight) : 1,
    },
  };
}

function toSpot(row) {
  return {
    ...(row.data || {}),
    id: `team-${row.id}`,
    name: row.name,
    source: 'team',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 허용 출처에서 온 구성원 또는 관리자. 아니면 null(응답 완료). */
function requireActor(req, res) {
  const source = req.headers?.referer || req.headers?.origin || '';
  if (!isAllowedPublishOrigin(source)) {
    fail(res, 403, 'forbidden', '허용되지 않은 요청입니다.');
    return null;
  }
  if (isAdminRouteReferer(req)) {
    if (hasValidAdminSession(req)) return { role: 'admin', code: 'admin' };
    fail(res, 403, 'forbidden', '관리자 로그인이 필요합니다.');
    return null;
  }
  const code = memberCodeFromReferer(req);
  if (!code) {
    fail(res, 403, 'forbidden', '구성원 화면에서만 식당 목록을 쓸 수 있습니다.');
    return null;
  }
  return { role: 'member', code };
}

function rowIdFromQuery(req) {
  const url = new URL(req.url || '/', 'http://local');
  const raw = String(url.searchParams.get('id') || '').replace(/^team-/, '');
  return UUID_RE.test(raw) ? raw : null;
}

async function listSpots(req, res, client) {
  const actor = requireActor(req, res);
  if (!actor) return undefined;
  const { data, error } = await client.from(LUNCH_SPOTS_TABLE).select(COLUMNS).order('created_at', { ascending: true });
  if (error) return dbFailed(res, 'list', error);
  return json(res, 200, { ok: true, actor: actor.code, spots: (data || []).map(toSpot) });
}

async function findSameName(client, name, exceptId) {
  const { data, error } = await client.from(LUNCH_SPOTS_TABLE).select('id, name');
  if (error) return { error };
  const key = normalizeName(name);
  return { row: (data || []).find((r) => r.id !== exceptId && normalizeName(r.name) === key) || null };
}

async function createSpot(req, res, client, now) {
  const actor = requireActor(req, res);
  if (!actor) return undefined;
  const input = sanitizeSpotInput(await readJsonBody(req));
  if (!input) return fail(res, 400, 'invalid', '식당 이름을 입력하세요.');

  const dup = await findSameName(client, input.name);
  if (dup.error) return dbFailed(res, 'dup-check', dup.error);
  if (dup.row) {
    return fail(res, 409, 'duplicate', `「${dup.row.name}」은(는) 이미 팀 식당 목록에 있어요.`, {
      id: `team-${dup.row.id}`,
    });
  }

  const stamp = now.toISOString();
  const { data, error } = await client
    .from(LUNCH_SPOTS_TABLE)
    .insert({ name: input.name, data: input.data, created_by: actor.code, created_at: stamp, updated_at: stamp })
    .select(COLUMNS);
  if (error) return dbFailed(res, 'insert', error);
  const row = Array.isArray(data) ? data[0] : data;
  return json(res, 200, { ok: true, spot: toSpot(row) });
}

/** 등록한 구성원이나 관리자인지 확인하고 행을 돌려준다. 아니면 null(응답 완료). */
async function loadOwnedRow(req, res, client, actor) {
  const id = rowIdFromQuery(req);
  if (!id) {
    fail(res, 400, 'invalid', '식당 id 가 올바르지 않습니다.');
    return null;
  }
  const { data, error } = await client.from(LUNCH_SPOTS_TABLE).select(COLUMNS).eq('id', id).limit(1);
  if (error) {
    dbFailed(res, 'load', error);
    return null;
  }
  const row = data?.[0];
  if (!row) {
    fail(res, 404, 'not_found', '식당을 찾지 못했습니다.');
    return null;
  }
  if (actor.role !== 'admin' && row.created_by !== actor.code) {
    fail(res, 403, 'forbidden', '등록한 구성원이나 관리자만 바꿀 수 있어요.');
    return null;
  }
  return row;
}

async function updateSpot(req, res, client, now) {
  const actor = requireActor(req, res);
  if (!actor) return undefined;
  const row = await loadOwnedRow(req, res, client, actor);
  if (!row) return undefined;
  const input = sanitizeSpotInput(await readJsonBody(req));
  if (!input) return fail(res, 400, 'invalid', '식당 이름을 입력하세요.');

  const dup = await findSameName(client, input.name, row.id);
  if (dup.error) return dbFailed(res, 'dup-check', dup.error);
  if (dup.row) return fail(res, 409, 'duplicate', `「${dup.row.name}」은(는) 이미 팀 식당 목록에 있어요.`);

  const fields = { name: input.name, data: input.data, updated_at: now.toISOString() };
  const { error } = await client.from(LUNCH_SPOTS_TABLE).update(fields).eq('id', row.id);
  if (error) return dbFailed(res, 'update', error);
  return json(res, 200, { ok: true, spot: toSpot({ ...row, ...fields }) });
}

async function deleteSpot(req, res, client) {
  const actor = requireActor(req, res);
  if (!actor) return undefined;
  const row = await loadOwnedRow(req, res, client, actor);
  if (!row) return undefined;
  const { error } = await client.from(LUNCH_SPOTS_TABLE).delete().eq('id', row.id);
  if (error) return dbFailed(res, 'delete', error);
  return json(res, 200, { ok: true, id: `team-${row.id}` });
}

/** @param {{ now?: Date }} [options] 테스트용 현재 시각 */
export async function handleLunchSpots(req, res, client, options = {}) {
  const now = options.now || new Date();
  if (req.method === 'GET') return listSpots(req, res, client);
  if (req.method === 'POST') return createSpot(req, res, client, now);
  if (req.method === 'PATCH') return updateSpot(req, res, client, now);
  if (req.method === 'DELETE') return deleteSpot(req, res, client);
  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return fail(res, 405, 'error', 'method not allowed');
}
