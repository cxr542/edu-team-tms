import { useCallback, useEffect, useState } from 'react';
import {
  CUSTOM_ORIGIN_PRESET_ID,
  DEFAULT_LUNCH_ORIGIN,
  LUNCH_ORIGIN_PRESETS,
  LUNCH_ORIGIN_STORAGE_KEY,
} from '../constants/lunchOrigins';

/** @typedef {import('../constants/lunchOrigins').LunchOriginPreset} LunchOriginPreset */

/** @typedef {{
 *   presetId: string,
 *   customLabel?: string,
 *   customLat?: number,
 *   customLng?: number,
 *   customRadiusM?: number,
 * }} StoredOrigin */

function readStored() {
  try {
    const raw = localStorage.getItem(LUNCH_ORIGIN_STORAGE_KEY);
    if (!raw) return null;
    return /** @type {StoredOrigin} */ (JSON.parse(raw));
  } catch {
    return null;
  }
}

/** @param {StoredOrigin | null} stored */
export function resolveOrigin(stored) {
  if (!stored || stored.presetId === DEFAULT_LUNCH_ORIGIN.id) {
    return { ...DEFAULT_LUNCH_ORIGIN };
  }
  if (stored.presetId === CUSTOM_ORIGIN_PRESET_ID) {
    const lat = Number(stored.customLat);
    const lng = Number(stored.customLng);
    const label = String(stored.customLabel || '').trim() || '직접 지정';
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        id: CUSTOM_ORIGIN_PRESET_ID,
        label,
        center: { lat, lng },
        radiusM: Number(stored.customRadiusM) > 0 ? Number(stored.customRadiusM) : 1000,
        searchHint: `${label} 맛집`,
      };
    }
  }
  const preset = LUNCH_ORIGIN_PRESETS.find((p) => p.id === stored.presetId);
  return preset ? { ...preset } : { ...DEFAULT_LUNCH_ORIGIN };
}

export function useLunchOrigin() {
  const [stored, setStored] = useState(readStored);
  const [origin, setOriginState] = useState(() => resolveOrigin(readStored()));

  const applyStored = useCallback((next) => {
    if (next) localStorage.setItem(LUNCH_ORIGIN_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(LUNCH_ORIGIN_STORAGE_KEY);
    setStored(next);
    setOriginState(resolveOrigin(next));
  }, []);

  const setPreset = useCallback(
    (presetId) => {
      if (presetId === CUSTOM_ORIGIN_PRESET_ID) {
        const prev = readStored();
        applyStored({
          presetId: CUSTOM_ORIGIN_PRESET_ID,
          customLabel: prev?.customLabel || '',
          customLat: prev?.customLat ?? DEFAULT_LUNCH_ORIGIN.center.lat,
          customLng: prev?.customLng ?? DEFAULT_LUNCH_ORIGIN.center.lng,
          customRadiusM: prev?.customRadiusM ?? 1000,
        });
        return;
      }
      applyStored({ presetId });
    },
    [applyStored]
  );

  const setCustomOrigin = useCallback(
    ({ label, lat, lng, radiusM }) => {
      applyStored({
        presetId: CUSTOM_ORIGIN_PRESET_ID,
        customLabel: label,
        customLat: lat,
        customLng: lng,
        customRadiusM: radiusM,
      });
    },
    [applyStored]
  );

  const resetOrigin = useCallback(() => {
    applyStored(null);
  }, [applyStored]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LUNCH_ORIGIN_STORAGE_KEY) {
        const s = readStored();
        setStored(s);
        setOriginState(resolveOrigin(s));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return {
    origin,
    stored,
    setPreset,
    setCustomOrigin,
    resetOrigin,
    presets: LUNCH_ORIGIN_PRESETS,
    customPresetId: CUSTOM_ORIGIN_PRESET_ID,
  };
}
