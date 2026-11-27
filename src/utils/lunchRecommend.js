import {
  LUNCH_PRICE_OVER,
  LUNCH_PRICE_UNKNOWN,
  LUNCH_PRICE_WITHIN,
} from '../constants/lunchPick.js';

/** @param {LunchSpot} spot @param {number} filterLevel */
function matchesPriceFilter(spot, filterLevel) {
  if (filterLevel === 0) return true;
  const level = spot.priceLevel ?? LUNCH_PRICE_UNKNOWN;
  if (filterLevel === LUNCH_PRICE_WITHIN) {
    return level === LUNCH_PRICE_WITHIN || level === LUNCH_PRICE_UNKNOWN;
  }
  if (filterLevel === LUNCH_PRICE_OVER) {
    return level === LUNCH_PRICE_OVER;
  }
  return level === filterLevel;
}

/**
 * @typedef {import('../hooks/useLunchSpots').LunchSpot} LunchSpot
 */

/**
 * @param {LunchSpot} spot
 * @param {{ priceLevel: number, maxWalkMinutes: number, tags: string[], excludeIds: Set<string> }} filters
 */
export function spotMatchesFilters(spot, filters) {
  if (filters.excludeIds.has(spot.id)) return false;
  if (filters.priceLevel > 0 && !matchesPriceFilter(spot, filters.priceLevel)) return false;
  if (filters.maxWalkMinutes > 0 && spot.walkMinutes > filters.maxWalkMinutes) return false;
  if (filters.tags.length > 0) {
    const spotTags = spot.tags || [];
    if (!filters.tags.every((t) => spotTags.includes(t))) return false;
  }
  return true;
}

/**
 * @param {LunchSpot[]} spots
 * @param {{ priceLevel: number, maxWalkMinutes: number, tags: string[], excludeIds: Set<string> }} filters
 */
export function filterSpots(spots, filters) {
  return spots.filter((s) => spotMatchesFilters(s, filters));
}

/**
 * @param {LunchSpot[]} candidates
 * @param {number} count
 * @param {() => number} [random]
 */
export function pickWeightedRandom(candidates, count, random = Math.random) {
  if (!candidates.length) return [];
  const pool = [...candidates];
  const picked = [];
  const n = Math.min(count, pool.length);

  for (let i = 0; i < n; i += 1) {
    const totalWeight = pool.reduce((sum, s) => sum + (s.weight ?? 1), 0);
    let r = random() * totalWeight;
    let idx = 0;
    for (; idx < pool.length; idx += 1) {
      r -= pool[idx].weight ?? 1;
      if (r <= 0) break;
    }
    const chosen = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
    picked.push(chosen);
  }
  return picked;
}

/**
 * 식대 필터가 「전체」일 때 13,000원 이내(priceLevel 1)를 먼저 뽑고, 부족하면 초과 구간으로 채움.
 * @param {LunchSpot[]} pool
 * @param {number} priceLevelFilter 0 = 전체(우선), 1|2 = 해당 구간만
 * @param {number} count
 * @param {() => number} random
 */
export function pickWithPricePriority(pool, priceLevelFilter, count, random = Math.random) {
  if (priceLevelFilter !== 0 || !pool.length) {
    return pickWeightedRandom(pool, count, random);
  }

  const tiers = [
    pool.filter((s) => s.priceLevel === LUNCH_PRICE_WITHIN),
    pool.filter((s) => (s.priceLevel ?? LUNCH_PRICE_UNKNOWN) === LUNCH_PRICE_UNKNOWN),
    pool.filter((s) => s.priceLevel === LUNCH_PRICE_OVER),
  ];

  const picks = [];
  for (const tier of tiers) {
    if (picks.length >= count || !tier.length) continue;
    const remaining = tier.filter((s) => !picks.some((p) => p.id === s.id));
    picks.push(...pickWeightedRandom(remaining, count - picks.length, random));
  }
  return picks;
}

/**
 * @param {LunchSpot[]} spots
 * @param {object} filters
 * @param {Set<string>} sessionExclude
 * @param {() => number} [random]
 * @returns {{ primary: LunchSpot | null, alternatives: LunchSpot[], poolSize: number }}
 */
export function recommendLunch(spots, filters, sessionExclude, random = Math.random) {
  const excludeIds = new Set([...sessionExclude, ...(filters.excludeIds || [])]);
  const merged = { ...filters, excludeIds };
  const pool = balanceKakaoWeights(filterSpots(spots, merged));
  if (!pool.length) {
    return { primary: null, alternatives: [], poolSize: 0 };
  }
  const picks = pickWithPricePriority(pool, merged.priceLevel, 3, random);
  return {
    primary: picks[0] || null,
    alternatives: picks.slice(1),
    poolSize: pool.length,
  };
}

/**
 * @param {string[]} visitedIds
 * @param {Record<string, string>} historyById id -> ISO date
 * @param {number} skipDays
 */
export function buildHistoryExcludeIds(visitedIds, historyById, skipDays) {
  if (!skipDays) return new Set();
  const cutoff = Date.now() - skipDays * 24 * 60 * 60 * 1000;
  const exclude = new Set();
  for (const id of visitedIds) {
    const at = historyById[id];
    if (!at) continue;
    if (new Date(at).getTime() >= cutoff) exclude.add(id);
  }
  return exclude;
}

/**
 * @param {import('../hooks/useLunchSpots').KakaoPlace} place
 * @returns {LunchSpot}
 */
export function kakaoPlaceToSpot(place) {
  return {
    id: `kakao-${place.id}`,
    name: place.name,
    category: place.category || '음식점',
    priceLevel: LUNCH_PRICE_UNKNOWN, // 카카오 API는 메뉴 가격 없음 — 초과로 단정하지 않음
    walkMinutes: place.walkMinutes ?? 10,
    exitHint: place.address || '',
    tags: [],
    menuHints: [],
    mapUrl: place.mapUrl,
    teamNote: '카카오 검색 · 메뉴 가격은 매장에서 확인',
    weight: 0.5,
    source: 'kakao',
  };
}

/** 카카오 장소 URL 의 장소 번호(같은 식당 판별용) */
function kakaoPlaceIdFromUrl(url) {
  const m = String(url || '').match(/place\.map\.kakao\.com\/(\d+)/);
  return m ? m[1] : '';
}

const normalizeSpotName = (name) => String(name || '').replace(/\s+/g, '').toLowerCase();

/**
 * 팀 목록에 카카오 근처 식당을 덧붙인다. 같은 식당(이름 또는 카카오 장소 번호가 같음)은 팀 목록 것을 남긴다.
 * 가중치는 뽑을 때(balanceKakaoWeights) 조건을 거친 후보 기준으로 낮춘다.
 * @param {LunchSpot[]} base
 * @param {LunchSpot[]} kakao
 */
export function mergeKakaoIntoCatalog(base, kakao) {
  const names = new Set(base.map((s) => normalizeSpotName(s.name)));
  const placeIds = new Set(base.map((s) => kakaoPlaceIdFromUrl(s.mapUrl)).filter(Boolean));
  const ids = new Set(base.map((s) => s.id));
  const extra = kakao.filter((s) => {
    if (ids.has(s.id) || names.has(normalizeSpotName(s.name))) return false;
    const pid = kakaoPlaceIdFromUrl(s.mapUrl);
    return !(pid && placeIds.has(pid));
  });
  return extra.length ? [...base, ...extra] : base;
}

const KAKAO_SHARE = 0.3;

/**
 * 카카오 식당은 메뉴·가격·태그가 없으니, 후보 안에서 카카오 식당 가중치 합이
 * 팀 식당 가중치 합의 30%를 넘지 않게 낮춘다(팀 식당이 없으면 그대로).
 * @param {LunchSpot[]} pool
 */
export function balanceKakaoWeights(pool) {
  const kakao = pool.filter((s) => s.source === 'kakao');
  if (!kakao.length || kakao.length === pool.length) return pool;
  const teamWeight = pool.reduce((sum, s) => (s.source === 'kakao' ? sum : sum + (s.weight ?? 1)), 0);
  const kakaoWeight = kakao.reduce((sum, s) => sum + (s.weight ?? 1), 0);
  const cap = teamWeight * KAKAO_SHARE;
  if (kakaoWeight <= cap) return pool;
  const ratio = cap / kakaoWeight;
  return pool.map((s) => (s.source === 'kakao' ? { ...s, weight: (s.weight ?? 1) * ratio } : s));
}
