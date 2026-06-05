import { useCallback, useEffect, useState } from 'react';
import { LUNCH_CUSTOM_SPOTS_KEY } from '../constants/lunchPick';

/** @typedef {import('./useLunchSpots').LunchSpot} LunchSpot */

/** @param {string[]} tags */
export function normalizeLunchTags(tags) {
  const mapped = (tags || [])
    .map((t) => {
      if (t === 'western') return 'cuisineWestern';
      return t;
    })
    .filter(Boolean);
  return [...new Set(mapped)];
}

export function readCustomSpots() {
  try {
    const raw = localStorage.getItem(LUNCH_CUSTOM_SPOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => ({
      ...s,
      tags: normalizeLunchTags(Array.isArray(s.tags) ? s.tags : []),
    }));
  } catch {
    return [];
  }
}

function writeCustom(spots) {
  localStorage.setItem(LUNCH_CUSTOM_SPOTS_KEY, JSON.stringify(spots));
}

export function createCustomSpotId() {
  return `custom-${Date.now()}`;
}

/** @param {Partial<LunchSpot> & { name: string }} input */
export function normalizeCustomSpot(input) {
  const menuHints = Array.isArray(input.menuHints)
    ? input.menuHints
    : String(input.menuHints || '')
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
  const tags = normalizeLunchTags(Array.isArray(input.tags) ? input.tags : []);
  const menus = Array.isArray(input.menus)
    ? input.menus
        .filter((m) => m?.name)
        .map((m) => ({
          name: String(m.name).trim(),
          priceWon: Number.isFinite(Number(m.priceWon)) ? Number(m.priceWon) : undefined,
        }))
    : [];
  return {
    id: input.id || createCustomSpotId(),
    name: String(input.name || '').trim(),
    category: String(input.category || '기타').trim(),
    priceLevel: Number(input.priceLevel) === 2 ? 2 : 1,
    walkMinutes: Math.max(1, Number(input.walkMinutes) || 5),
    exitHint: String(input.exitHint || '').trim(),
    tags,
    menuHints,
    menus: menus.length ? menus : undefined,
    mapUrl: String(input.mapUrl || '').trim(),
    teamNote: String(input.teamNote || '').trim(),
    weight: Number(input.weight) > 0 ? Number(input.weight) : 1,
    source: 'custom',
    addedAt: input.addedAt || new Date().toISOString(),
  };
}

export function useLunchCustomSpots() {
  const [customSpots, setCustomSpots] = useState(readCustomSpots);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LUNCH_CUSTOM_SPOTS_KEY) setCustomSpots(readCustomSpots());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addSpot = useCallback((input) => {
    const spot = normalizeCustomSpot(input);
    if (!spot.name) return null;
    setCustomSpots((prev) => {
      const next = [...prev.filter((s) => s.id !== spot.id), spot];
      writeCustom(next);
      return next;
    });
    return spot;
  }, []);

  const removeSpot = useCallback((id) => {
    setCustomSpots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeCustom(next);
      return next;
    });
  }, []);

  const clearCustom = useCallback(() => {
    writeCustom([]);
    setCustomSpots([]);
  }, []);

  return { customSpots, addSpot, removeSpot, clearCustom };
}
