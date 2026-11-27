/**
 * 점심 방문 기록(서버 lunch_visits) 가공 — 이번 주 보기, 자주 간 곳.
 * @typedef {{ day: string, spotId: string, spotName: string, category?: string }} LunchVisit
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];

/** 한국 시간 기준 YYYY-MM-DD */
export function kstTodayKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseDay(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * 오늘이 속한 주의 월~금. 주말이면 다가오는 주가 아니라 지나간 주를 보여준다.
 * @param {string} todayKey
 * @param {LunchVisit[]} visits
 */
export function buildWeekView(todayKey, visits = []) {
  const today = parseDay(todayKey);
  const dow = today.getUTCDay(); // 0 일 ~ 6 토
  const offsetToMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today.getTime() - offsetToMonday * DAY_MS);
  const byDay = new Map(visits.map((v) => [v.day, v]));

  return WEEKDAY_LABELS.map((label, i) => {
    const key = formatDay(new Date(monday.getTime() + i * DAY_MS));
    return {
      key,
      label,
      visit: byDay.get(key) || null,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });
}

/**
 * 많이 간 순(같으면 최근 순).
 * @param {LunchVisit[]} visits
 * @param {number} [limit]
 */
export function topVisitedSpots(visits = [], limit = 3) {
  const map = new Map();
  for (const v of visits) {
    const cur = map.get(v.spotId) || { spotId: v.spotId, spotName: v.spotName, count: 0, lastDay: '' };
    cur.count += 1;
    if (v.day > cur.lastDay) {
      cur.lastDay = v.day;
      cur.spotName = v.spotName;
    }
    map.set(v.spotId, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || (a.lastDay < b.lastDay ? 1 : -1))
    .slice(0, limit);
}

/**
 * 추천 제외용 { spotId: ISO 시각 } — 기존 브라우저 기록 형식과 맞춘다(더 최근 값 우선).
 * @param {LunchVisit[]} visits
 * @param {Record<string, string>} [legacy]
 */
export function mergeVisitHistory(visits = [], legacy = {}) {
  const out = { ...legacy };
  for (const v of visits) {
    const iso = `${v.day}T03:00:00.000Z`; // 12시 KST
    if (!out[v.spotId] || out[v.spotId] < iso) out[v.spotId] = iso;
  }
  return out;
}

/**
 * 서버를 못 쓸 때(로컬 개발 등) 브라우저 기록(식당별 마지막 방문 시각)으로 근사한다.
 * @param {Record<string, string>} history
 * @param {(id: string) => { name?: string, category?: string } | undefined} findSpot
 */
export function visitsFromLegacyHistory(history = {}, findSpot = () => undefined) {
  const byDay = new Map();
  for (const [spotId, iso] of Object.entries(history)) {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) continue;
    const day = kstTodayKey(at);
    const spot = findSpot(spotId);
    const prev = byDay.get(day);
    if (prev && prev.at > at) continue;
    byDay.set(day, { at, visit: { day, spotId, spotName: spot?.name || spotId, category: spot?.category || '' } });
  }
  return [...byDay.values()].map((x) => x.visit).sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** 단골 기준: 최근 30일(오늘 포함) 안에 3번 이상 간 곳 */
export const REGULAR_DAYS = 30;
export const REGULAR_MIN_VISITS = 3;

const normalizeName = (name) => String(name || '').replace(/\s+/g, '').toLowerCase();

/**
 * 최근 N일 방문 기록으로 단골 식당을 고른다. 이름(공백 무시)이 같으면 같은 식당으로 센다
 * — 칸에서 이름만 적어 기록한 곳과 목록에서 고른 곳이 합쳐지도록.
 * @param {LunchVisit[]} visits
 * @param {string} todayKey YYYY-MM-DD
 * @param {{ days?: number, min?: number }} [opts]
 * @returns {{ name: string, spotName: string, spotIds: string[], count: number, lastDay: string }[]}
 */
export function findRegularSpots(visits = [], todayKey, opts = {}) {
  const days = opts.days ?? REGULAR_DAYS;
  const min = opts.min ?? REGULAR_MIN_VISITS;
  const since = formatDay(new Date(parseDay(todayKey).getTime() - (days - 1) * DAY_MS));
  const groups = new Map();
  for (const v of visits) {
    if (!v?.day || v.day < since || v.day > todayKey) continue;
    const key = normalizeName(v.spotName) || v.spotId;
    const g = groups.get(key) || { name: key, spotName: v.spotName, spotIds: [], count: 0, lastDay: '' };
    g.count += 1;
    if (!g.spotIds.includes(v.spotId)) g.spotIds.push(v.spotId);
    if (v.day > g.lastDay) {
      g.lastDay = v.day;
      g.spotName = v.spotName;
    }
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.count >= min)
    .sort((a, b) => b.count - a.count || (a.lastDay < b.lastDay ? 1 : -1));
}

/**
 * @param {{ id: string, name: string }} spot
 * @param {ReturnType<typeof findRegularSpots>} regulars
 */
export function isRegularSpot(spot, regulars = []) {
  if (!spot) return false;
  const name = normalizeName(spot.name);
  return regulars.some((g) => g.spotIds.includes(spot.id) || (name && g.name === name));
}

/**
 * 팀 기록(구성원 코드 포함)에서 구성원별 단골을 구한다.
 * @param {(LunchVisit & { memberCode: string })[]} teamVisits
 * @param {string} todayKey
 * @returns {{ memberCode: string, regulars: ReturnType<typeof findRegularSpots> }[]}
 */
export function regularsByMember(teamVisits = [], todayKey) {
  const byCode = new Map();
  for (const v of teamVisits) {
    if (!v?.memberCode) continue;
    if (!byCode.has(v.memberCode)) byCode.set(v.memberCode, []);
    byCode.get(v.memberCode).push(v);
  }
  return [...byCode.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([memberCode, visits]) => ({ memberCode, regulars: findRegularSpots(visits, todayKey) }));
}

/** 이 식당을 단골로 둔 구성원 코드 목록 */
export function regularOwners(spot, byMember = []) {
  return byMember.filter((m) => isRegularSpot(spot, m.regulars)).map((m) => m.memberCode);
}
