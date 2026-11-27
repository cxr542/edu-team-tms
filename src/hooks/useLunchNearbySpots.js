import { useEffect, useState } from 'react';
import { kakaoPlaceToSpot } from '../utils/lunchRecommend';
import { isLunchMealPlace, LUNCH_KAKAO_QUERIES, searchKakaoLocal } from '../utils/lunchKakaoApi';

const MAX_PAGES = 3; // 카카오 키워드 검색은 15곳씩 최대 45곳

/**
 * 카카오 로컬 API로 기준 위치 주변 점심 식사 가게를 모은다.
 * 위치 검색어(예: 파크원타워 맛집)는 3쪽까지, 점심 메뉴 검색어(한식·국밥·중식…)는
 * 반경 1km 면 거리순 1쪽, 더 넓으면 정확도순 2쪽씩 가져와 합치고, 빵집·디저트·카페·술집은 뺀다.
 * 여의도 시드를 쓰는 위치에서는 includeKakao 가 켜져 있을 때만 불러와 팀 목록에 합친다.
 * @param {import('../constants/lunchOrigins').LunchOriginPreset} origin
 * @param {boolean} useSeedCatalog
 * @param {boolean} [includeKakao]
 */
export function useLunchNearbySpots(origin, useSeedCatalog, includeKakao = true) {
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (useSeedCatalog && !includeKakao) {
      setNearby([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const base = {
        lat: origin.center.lat,
        lng: origin.center.lng,
        radius: origin.radiusM,
        purpose: 'food',
      };
      const places = [];
      let first = null;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = await searchKakaoLocal({ ...base, query: origin.searchHint || `${origin.label} 맛집`, page });
        if (cancelled) return;
        first = first || res;
        places.push(...(res.places || []));
        if (!res.available || res.error || res.isEnd) break;
      }

      if (first?.available && !first.error) {
        // 1km 는 거리순 1쪽(가까운 15곳), 더 넓으면(배달) 정확도순 2쪽으로 반경 안을 고르게 모은다.
        const wide = origin.radiusM > 1000;
        const pages = wide ? [1, 2] : [1];
        const more = await Promise.all(
          LUNCH_KAKAO_QUERIES.flatMap((query) =>
            pages.map((page) =>
              searchKakaoLocal({ ...base, query, page, ...(wide ? { sort: 'accuracy' } : {}) })
            )
          )
        );
        if (cancelled) return;
        for (const r of more) places.push(...(r.places || []));
      }

      const unique = [...new Map(places.map((p) => [p.id, p])).values()].filter(isLunchMealPlace);
      setAvailable(first?.available ?? false);
      setNearby(unique.map(kakaoPlaceToSpot));
      setError(first?.error || null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    useSeedCatalog,
    includeKakao,
    origin.id,
    origin.label,
    origin.center.lat,
    origin.center.lng,
    origin.radiusM,
    origin.searchHint,
  ]);

  return { nearby, loading, error, available };
}
