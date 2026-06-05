import { useEffect, useState } from 'react';
import { kakaoPlaceToSpot } from '../utils/lunchRecommend';
import { searchKakaoLocal } from '../utils/lunchKakaoApi';

/**
 * 기준 위치가 여의도 시드가 아닐 때 카카오 로컬 API로 주변 음식점 목록 로드
 * @param {import('../constants/lunchOrigins').LunchOriginPreset} origin
 * @param {boolean} useSeedCatalog
 */
export function useLunchNearbySpots(origin, useSeedCatalog) {
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (useSeedCatalog) {
      setNearby([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const res = await searchKakaoLocal({
        query: origin.searchHint || `${origin.label} 맛집`,
        lat: origin.center.lat,
        lng: origin.center.lng,
        radius: origin.radiusM,
        purpose: 'food',
      });

      if (cancelled) return;

      setAvailable(res.available);
      setNearby((res.places || []).map(kakaoPlaceToSpot));
      setError(res.error || null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    useSeedCatalog,
    origin.id,
    origin.label,
    origin.center.lat,
    origin.center.lng,
    origin.radiusM,
    origin.searchHint,
  ]);

  return { nearby, loading, error, available };
}
