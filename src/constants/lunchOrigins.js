/** @typedef {{
 *   id: string,
 *   label: string,
 *   center: { lat: number, lng: number },
 *   radiusM: number,
 *   searchHint: string,
 * }} LunchOriginPreset */

export const LUNCH_ORIGIN_STORAGE_KEY = 'tms-lunch-origin-v1';

/** 오케스트로 파크원타워2 (NH금융타워) — 여의대로 108 */
export const DEFAULT_LUNCH_ORIGIN = /** @type {LunchOriginPreset} */ ({
  id: 'okestro-parc1t2',
  label: '오케스트로 (파크원타워2)',
  center: { lat: 37.5261, lng: 126.9282 },
  radiusM: 1000,
  searchHint: '파크원타워 맛집',
});

/** @type {LunchOriginPreset[]} */
export const LUNCH_ORIGIN_PRESETS = [
  DEFAULT_LUNCH_ORIGIN,
  {
    id: 'yeouido-station',
    label: '여의도역',
    center: { lat: 37.5213, lng: 126.9242 },
    radiusM: 1000,
    searchHint: '여의도역 맛집',
  },
];

export const CUSTOM_ORIGIN_PRESET_ID = 'custom';

/** 여의도 팀 시드 JSON(yeouido-lunch.json)을 쓰는 프리셋 */
export const YEOUIDO_LUNCH_PRESET_IDS = new Set(['okestro-parc1t2', 'yeouido-station']);

/** 직접 지정이어도 프리셋 좌표 근처면 시드 사용 (이름만 같고 presetId가 custom인 경우) */
export const YEOUIDO_SEED_SNAP_RADIUS_M = 500;

/**
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** @param {{ lat: number, lng: number }} center @param {number} [radiusM] */
export function isNearYeouidoPreset(center, radiusM = YEOUIDO_SEED_SNAP_RADIUS_M) {
  return LUNCH_ORIGIN_PRESETS.some((p) => distanceMeters(center, p.center) <= radiusM);
}

/** @param {{ id: string, center: { lat: number, lng: number } }} origin */
export function usesYeouidoSeedCatalog(origin) {
  if (YEOUIDO_LUNCH_PRESET_IDS.has(origin.id)) return true;
  if (origin.id === CUSTOM_ORIGIN_PRESET_ID && isNearYeouidoPreset(origin.center)) {
    return true;
  }
  return false;
}

/** @param {number} radiusM */
export function radiusMToKm(radiusM) {
  const km = Number(radiusM) / 1000;
  if (!Number.isFinite(km) || km <= 0) return 1;
  return Math.round(km * 10) / 10;
}

/** @param {number} radiusM */
export function formatRadiusKm(radiusM) {
  const km = radiusMToKm(radiusM);
  return `${Number.isInteger(km) ? km : km.toFixed(1)}km`;
}

/** 기준 위치 반경 빠른 선택(배달까지 생각하면 넓게) */
export const LUNCH_RADIUS_OPTIONS = [
  { value: 1000, label: '1km', hint: '걸어서' },
  { value: 2000, label: '2km', hint: '' },
  { value: 3000, label: '3km', hint: '배달' },
  { value: 5000, label: '5km', hint: '' },
];

/** @param {number|string} km */
export function kmToRadiusM(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n <= 0) return 1000;
  return Math.round(n * 1000);
}
