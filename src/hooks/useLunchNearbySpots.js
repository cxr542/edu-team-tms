import { useEffect, useState } from 'react';
import { kakaoPlaceToSpot } from '../utils/lunchRecommend';
import { searchKakaoLocal } from '../utils/lunchKakaoApi';

const MAX_PAGES = 3; // 카카오 키워드 검색은 15곳씩 최대 45곳

/**
 * 카카오 로컬 API로 기준 위치 주변 음식점(최대 45곳)을 불러온다.
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
      const places = [];
      let res = null;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        res = await searchKakaoLocal({
          query: origin.searchHint || `${origin.label} 맛집`,
          page,
          lat: origin.center.lat,
          lng: origin.center.lng,
          radius: origin.radiusM,
          purpose: 'food',
        });
        if (cancelled) return;
        places.push(...(res.places || []));
        if (!res.available || res.error || res.isEnd) break;
      }

      const unique = [...new Map(places.map((p) => [p.id, p])).values()];
      setAvailable(res.available);
      setNearby(unique.map(kakaoPlaceToSpot));
      setError(res.error || null);
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
