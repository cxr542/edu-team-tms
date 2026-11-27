/**
 * 오늘 뭐 먹지 — 구성원별 점심 방문 기록 (service role, 테이블 lunch_visits).
 *
 * - GET     요청한 화면 주소의 구성원 기록을 최근 순으로 돌려준다(기본 120일).
 * - POST    점심을 기록한다(기본 오늘, 한국 시간). 하루 한 곳이라 같은 날 다시 보내면 바꾼다.
 *           몸통 day(YYYY-MM-DD)로 지난 6일 안의 날짜도 고를 수 있다(빠뜨린 날 채우기). 미래는 거절.
 * - DELETE  기록을 지운다(기본 오늘, ?day= 로 지난 6일 안의 날짜).
 *
 * 구성원은 Referer 주소(/yhkim, /wschoi, /hyshin)로만 정한다. 몸통의 구성원 값은 받지 않는다.
 * Origin/Referer 는 인증이 아니다. 점심 기록이라 이 약한 검사로 충분하다고 보고, 관리자 화면(/admin)은
 * 구성원이 없으므로 거절한다.
 */
import { readJsonBody } from './announcementEngagement.js';
import { isAllowedPublishOrigin } from './publishOrigin.js';
import { memberCodeFromReferer } from './requestScope.js';

export const LUNCH_VISITS_TABLE = 'lunch_visits';
const DEFAULT_DAYS = 120;
const MAX_DAYS = 400;
const LIMITS = { spotId: 200, spotName: 120, category: 40 };
const BACKFILL_DAYS = 6;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLUMNS = 'member_code, visited_on, spot_id, spot_name, category, updated_at';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function fail(res, status, code, message) {
  return json(res, status, { ok: false, status: code, message });
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** 한국 시간 기준 YYYY-MM-DD */
export function kstDayKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 요청한 날짜가 오늘~지난 6일 안이면 그 날짜, 비었으면 오늘, 아니면 null */
function resolveDay(raw, now) {
  const today = kstDayKey(now);
  if (raw == null || raw === '') return today;
  if (typeof raw !== 'string' || !DAY_RE.test(raw)) return null;
  const earliest = kstDayKey(new Date(now.getTime() - BACKFILL_DAYS * 24 * 60 * 60 * 1000));
  return raw >= earliest && raw <= today ? raw : null;
}

function dbFailed(res, action, error) {
  console.error(`[lunch-visits] ${action} failed:`, error?.message || error);
  return fail(res, 500, 'error', '점심 기록을 처리하지 못했습니다.');
}

function toVisit(row) {
  return {
    day: row.visited_on,
    spotId: row.spot_id,
    spotName: row.spot_name,
    category: row.category || '',
  };
}

/** 허용 출처 + 구성원 주소에서 온 요청만 받는다. 통과하면 구성원 코드, 아니면 null(응답 완료). */
function requireMember(req, res) {
  const source = req.headers?.referer || req.headers?.origin || '';
  if (!isAllowedPublishOrigin(source)) {
    fail(res, 403, 'forbidden', '허용되지 않은 요청입니다.');
    return null;
  }
  const memberCode = memberCodeFromReferer(req);
  if (!memberCode) {
    fail(res, 403, 'forbidden', '구성원 화면에서만 점심 기록을 쓸 수 있습니다.');
    return null;
  }
  return memberCode;
}

async function listVisits(req, res, client, now) {
  const memberCode = requireMember(req, res);
  if (!memberCode) return undefined;

  const url = new URL(req.url || '/', 'http://local');
  const rawDays = Number.parseInt(url.searchParams.get('days') || '', 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, MAX_DAYS) : DEFAULT_DAYS;
  const since = kstDayKey(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));

  const { data, error } = await client
    .from(LUNCH_VISITS_TABLE)
    .select(COLUMNS)
    .eq('member_code', memberCode)
    .gte('visited_on', since)
    .order('visited_on', { ascending: false });
  if (error) return dbFailed(res, 'list', error);
  return json(res, 200, { ok: true, memberCode, today: kstDayKey(now), visits: (data || []).map(toVisit) });
}

async function recordVisit(req, res, client, now) {
  const memberCode = requireMember(req, res);
  if (!memberCode) return undefined;

  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail(res, 400, 'invalid', '요청 형식이 올바르지 않습니다.');
  }
  const spotId = asText(body.spotId);
  const spotName = asText(body.spotName);
  const category = asText(body.category).slice(0, LIMITS.category);
  if (!spotId || spotId.length > LIMITS.spotId) return fail(res, 400, 'invalid', 'spotId 가 올바르지 않습니다.');
  if (!spotName || spotName.length > LIMITS.spotName) {
    return fail(res, 400, 'invalid', 'spotName 이 올바르지 않습니다.');
  }

  const day = resolveDay(body.day, now);
  if (!day) return fail(res, 400, 'invalid', `오늘부터 ${BACKFILL_DAYS}일 전까지만 기록할 수 있습니다.`);
  const fields = { spot_id: spotId, spot_name: spotName, category, updated_at: now.toISOString() };

  const { data: existing, error: findError } = await client
    .from(LUNCH_VISITS_TABLE)
    .select('id')
    .eq('member_code', memberCode)
    .eq('visited_on', day)
    .limit(1);
  if (findError) return dbFailed(res, 'find', findError);

  const write = existing?.length
    ? client.from(LUNCH_VISITS_TABLE).update(fields).eq('member_code', memberCode).eq('visited_on', day)
    : client.from(LUNCH_VISITS_TABLE).insert({ member_code: memberCode, visited_on: day, ...fields });
  const { error } = await write;
  if (error) return dbFailed(res, 'save', error);

  return json(res, 200, {
    ok: true,
    visit: { day, spotId, spotName, category },
  });
}

async function clearDay(req, res, client, now) {
  const memberCode = requireMember(req, res);
  if (!memberCode) return undefined;
  const url = new URL(req.url || '/', 'http://local');
  const day = resolveDay(url.searchParams.get('day'), now);
  if (!day) return fail(res, 400, 'invalid', `오늘부터 ${BACKFILL_DAYS}일 전까지만 지울 수 있습니다.`);
  const { error } = await client
    .from(LUNCH_VISITS_TABLE)
    .delete()
    .eq('member_code', memberCode)
    .eq('visited_on', day);
  if (error) return dbFailed(res, 'delete', error);
  return json(res, 200, { ok: true, day });
}

/** @param {{ now?: Date }} [options] 테스트용 현재 시각 */
export async function handleLunchVisits(req, res, client, options = {}) {
  const now = options.now || new Date();
  if (req.method === 'GET') return listVisits(req, res, client, now);
  if (req.method === 'POST') return recordVisit(req, res, client, now);
  if (req.method === 'DELETE') return clearDay(req, res, client, now);
  res.setHeader('Allow', 'GET, POST, DELETE');
  return fail(res, 405, 'error', 'method not allowed');
}
