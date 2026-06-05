import { KAKAO_CACHE_TTL_MS, KAKAO_SEARCH_CACHE_KEY } from '../constants/lunchPick';

function cacheKey(query, page, purpose = 'food') {
  return `${purpose}|${query}|${page}`;
}

function readCache(query, page, purpose = 'food') {
  try {
    const raw = sessionStorage.getItem(KAKAO_SEARCH_CACHE_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw);
    const entry = store[cacheKey(query, page, purpose)];
    if (!entry || Date.now() - entry.at > KAKAO_CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(query, page, data, purpose = 'food') {
  try {
    const raw = sessionStorage.getItem(KAKAO_SEARCH_CACHE_KEY);
    const store = raw ? JSON.parse(raw) : {};
    store[cacheKey(query, page, purpose)] = { at: Date.now(), data };
    sessionStorage.setItem(KAKAO_SEARCH_CACHE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ query: string, page?: number, lat?: number, lng?: number, radius?: number }} opts
 * @returns {Promise<{ places: import('../hooks/useLunchSpots').KakaoPlace[], available: boolean, error?: string }>}
 */
export async function searchKakaoLocal({ query, page = 1, lat, lng, radius, purpose = 'food' }) {
  const q = String(query || '').trim() || '여의도역 맛집';
  const cached = readCache(q, page, purpose);
  if (cached) return cached;

  const params = new URLSearchParams({ query: q, page: String(page), purpose });
  if (lat != null) params.set('lat', String(lat));
  if (lng != null) params.set('lng', String(lng));
  if (radius != null) params.set('radius', String(radius));

  try {
    const res = await fetch(`/api/kakao-local?${params}`);
    const body = await res.json();
    if (res.status === 503) {
      return { places: [], available: false, error: body.message || 'API 미설정' };
    }
    if (!res.ok) {
      const err = body.hint ? `${body.error} — ${body.hint}` : body.error || res.statusText;
      return { places: [], available: true, error: err };
    }
    const result = { places: body.places || [], available: true };
    writeCache(q, page, result, purpose);
    return result;
  } catch (e) {
    return { places: [], available: false, error: e.message || '검색 실패' };
  }
}

/**
 * 식당 이름으로 카카오 장소 1건 조회 (등록 폼 지도 URL 자동 채우기)
 * @param {{ name: string, lat?: number, lng?: number, radius?: number }} opts
 */
/** API 없을 때 카카오맵 검색 링크 (정확한 장소 페이지는 REST API 필요) */
export function buildKakaoMapSearchUrl(name) {
  const q = String(name || '').trim();
  if (!q) return '';
  return `https://map.kakao.com/link/search/${encodeURIComponent(q)}`;
}

export async function lookupKakaoPlaceByName({ name, lat, lng, radius }) {
  const q = String(name || '').trim();
  if (q.length < 2) {
    return { place: null, places: [], available: true };
  }
  const res = await searchKakaoLocal({ query: q, page: 1, lat, lng, radius });
  if (!res.available) {
    return { place: null, places: [], available: false, error: res.error };
  }
  if (res.error) {
    return { place: null, places: res.places, available: true, error: res.error };
  }
  const places = res.places || [];
  const normalized = q.replace(/\s/g, '').toLowerCase();
  const exact = places.find((p) => p.name.replace(/\s/g, '').toLowerCase() === normalized);
  const place = exact || places[0] || null;
  return { place, places, available: true };
}

/**
 * 역·건물명 등으로 위·경도 조회 (기준 위치 직접 지정)
 * @param {{ name: string, lat?: number, lng?: number }} opts
 * @returns {Promise<{ lat: number|null, lng: number|null, placeName?: string, available: boolean, error?: string }>}
 */
export async function lookupKakaoCoordsByName({ name, lat, lng }) {
  const q = String(name || '').trim();
  if (q.length < 2) {
    return { lat: null, lng: null, available: true };
  }

  const res = await searchKakaoLocal({
    query: q,
    page: 1,
    lat,
    lng,
    purpose: 'geocode',
  });

  if (!res.available) {
    return { lat: null, lng: null, available: false, error: res.error };
  }
  if (res.error) {
    return { lat: null, lng: null, available: true, error: res.error };
  }

  const places = res.places || [];
  const normalized = q.replace(/\s/g, '').toLowerCase();
  const exact = places.find((p) => p.name.replace(/\s/g, '').toLowerCase() === normalized);
  const pick = exact || places[0];
  if (!pick?.lat || !pick?.lng) {
    return { lat: null, lng: null, available: true, error: '검색 결과가 없습니다.' };
  }

  return {
    lat: pick.lat,
    lng: pick.lng,
    placeName: pick.name,
    available: true,
  };
}
