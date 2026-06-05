import { describe, expect, it } from 'vitest';
import { LUNCH_PRICE_OVER, LUNCH_PRICE_UNKNOWN, LUNCH_PRICE_WITHIN } from '../src/constants/lunchPick.js';
import {
  buildHistoryExcludeIds,
  filterSpots,
  kakaoPlaceToSpot,
  pickWeightedRandom,
  pickWithPricePriority,
  recommendLunch,
  spotMatchesFilters,
} from '../src/utils/lunchRecommend.js';

const spots = [
  { id: 'a', name: 'A', category: '한식', priceLevel: 1, walkMinutes: 5, tags: ['fast'], weight: 1 },
  { id: 'b', name: 'B', category: '일식', priceLevel: 2, walkMinutes: 10, tags: ['group'], weight: 2 },
  { id: 'c', name: 'C', category: '분식', priceLevel: 1, walkMinutes: 3, tags: ['fast', 'solo'], weight: 1 },
];

describe('spotMatchesFilters', () => {
  it('filters by lunch allowance tier and walk', () => {
    const f = { priceLevel: 1, maxWalkMinutes: 5, tags: [], excludeIds: new Set() };
    expect(spotMatchesFilters(spots[0], f)).toBe(true);
    expect(spotMatchesFilters(spots[1], f)).toBe(false);
  });

  it('price tier 2 excludes tier 1 only', () => {
    const f = { priceLevel: 2, maxWalkMinutes: 0, tags: [], excludeIds: new Set() };
    expect(spotMatchesFilters(spots[1], f)).toBe(true);
    expect(spotMatchesFilters(spots[0], f)).toBe(false);
  });

  it('식대 이내 filter includes unknown price tier', () => {
    const unknown = {
      id: 'u',
      name: 'U',
      category: '한식',
      priceLevel: LUNCH_PRICE_UNKNOWN,
      walkMinutes: 5,
      tags: [],
    };
    const f = { priceLevel: 1, maxWalkMinutes: 0, tags: [], excludeIds: new Set() };
    expect(spotMatchesFilters(unknown, f)).toBe(true);
    expect(spotMatchesFilters(spots[1], f)).toBe(false);
  });

  it('requires all tags', () => {
    const f = { priceLevel: 0, maxWalkMinutes: 0, tags: ['fast', 'solo'], excludeIds: new Set() };
    expect(spotMatchesFilters(spots[2], f)).toBe(true);
    expect(spotMatchesFilters(spots[0], f)).toBe(false);
  });
});

describe('pickWeightedRandom', () => {
  it('returns unique picks', () => {
    const picks = pickWeightedRandom(spots, 3, () => 0.1);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.id)).size).toBe(3);
  });
});

describe('pickWithPricePriority', () => {
  it('prefers 식대 이내 when filter is 전체 and enough candidates', () => {
    const pool = [
      ...spots.filter((s) => s.priceLevel === LUNCH_PRICE_WITHIN),
      { id: 'd', name: 'D', category: '한식', priceLevel: 1, walkMinutes: 4, tags: [], weight: 1 },
      { id: 'b', name: 'B', category: '일식', priceLevel: 2, walkMinutes: 10, tags: ['group'], weight: 100 },
    ];
    const picks = pickWithPricePriority(pool, 0, 3, () => 0.99);
    expect(picks).toHaveLength(3);
    expect(picks.every((p) => p.priceLevel === LUNCH_PRICE_WITHIN)).toBe(true);
  });

  it('fills with 초과 only when 이내 picks are fewer than count', () => {
    const picks = pickWithPricePriority(spots, 0, 3, () => 0.5);
    expect(picks.filter((p) => p.priceLevel === LUNCH_PRICE_WITHIN).length).toBe(2);
    expect(picks.some((p) => p.priceLevel === LUNCH_PRICE_OVER)).toBe(true);
  });

  it('falls back to 초과 when no 이내 in pool', () => {
    const onlyOver = spots.filter((s) => s.priceLevel === LUNCH_PRICE_OVER);
    const picks = pickWithPricePriority(onlyOver, 0, 1, () => 0.5);
    expect(picks[0].priceLevel).toBe(LUNCH_PRICE_OVER);
  });
});

describe('recommendLunch', () => {
  it('returns primary and alternatives', () => {
    const r = recommendLunch(spots, { priceLevel: 0, maxWalkMinutes: 0, tags: [], excludeIds: new Set() }, new Set(), () => 0.5);
    expect(r.primary).toBeTruthy();
    expect(r.alternatives.length).toBeLessThanOrEqual(2);
    expect(r.poolSize).toBe(3);
    expect(r.primary.priceLevel).toBe(LUNCH_PRICE_WITHIN);
  });

  it('default filter tier is 식대 이내 only', () => {
    const r = recommendLunch(
      spots,
      { priceLevel: LUNCH_PRICE_WITHIN, maxWalkMinutes: 0, tags: [], excludeIds: new Set() },
      new Set(),
      () => 0.5
    );
    expect(r.primary?.priceLevel).toBe(LUNCH_PRICE_WITHIN);
    expect(r.poolSize).toBe(2);
  });

  it('empty when all excluded', () => {
    const r = recommendLunch(
      spots,
      { priceLevel: 0, maxWalkMinutes: 0, tags: [], excludeIds: new Set(['a', 'b', 'c']) },
      new Set()
    );
    expect(r.primary).toBeNull();
    expect(r.poolSize).toBe(0);
  });
});

describe('buildHistoryExcludeIds', () => {
  it('excludes recent visits', () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 20 * 86400000).toISOString();
    const ex = buildHistoryExcludeIds(['a', 'b'], { a: now, b: old }, 7);
    expect(ex.has('a')).toBe(true);
    expect(ex.has('b')).toBe(false);
  });
});

describe('kakaoPlaceToSpot', () => {
  it('marks price as unknown not over', () => {
    const spot = kakaoPlaceToSpot({
      id: '1',
      name: '지리산식당',
      category: '한식',
      walkMinutes: 5,
      mapUrl: 'https://example.com',
    });
    expect(spot.priceLevel).toBe(LUNCH_PRICE_UNKNOWN);
  });
});

describe('filterSpots', () => {
  it('applies combined filters', () => {
    const list = filterSpots(spots, {
      priceLevel: 1,
      maxWalkMinutes: 6,
      tags: ['fast'],
      excludeIds: new Set(),
    });
    expect(list.map((s) => s.id).sort()).toEqual(['a', 'c']);
  });
});
