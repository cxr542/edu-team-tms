import { useCallback, useEffect, useMemo, useState } from 'react';
import { LUNCH_DATA_URL } from '../constants/lunchPick';
import { normalizeLunchTags, readCustomSpots } from './useLunchCustomSpots';

/** @typedef {{
 *   id: string,
 *   name: string,
 *   category: string,
 *   priceLevel: number,
 *   walkMinutes: number,
 *   exitHint?: string,
 *   tags?: string[],
 *   menuHints?: string[],
 *   mapUrl?: string,
 *   teamNote?: string,
 *   weight?: number,
 *   source?: 'curated' | 'kakao' | 'custom',
 *   addedAt?: string,
 * }} LunchSpot */

export function useLunchSpots() {
  const [seedSpots, setSeedSpots] = useState(/** @type {LunchSpot[]} */ ([]));
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customVersion, setCustomVersion] = useState(0);

  const reloadCustom = useCallback(() => {
    setCustomVersion((v) => v + 1);
  }, []);

  const customSpots = useMemo(() => {
    void customVersion;
    return readCustomSpots().map((s) => ({ ...s, source: 'custom' }));
  }, [customVersion]);

  const spots = useMemo(() => {
    const seed = seedSpots.map((s) => ({ ...s, source: s.source || 'curated' }));
    const customIds = new Set(customSpots.map((c) => c.id));
    return [...seed.filter((s) => !customIds.has(s.id)), ...customSpots];
  }, [seedSpots, customSpots]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(LUNCH_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        const list = (data.spots || []).map((s) => ({
          ...s,
          tags: normalizeLunchTags(Array.isArray(s.tags) ? s.tags : []),
          source: s.source || 'curated',
        }));
        setSeedSpots(list);
        setMeta(data.meta || null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || '맛집 목록을 불러오지 못했습니다.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    spots,
    seedSpots,
    customSpots,
    meta,
    loading,
    error,
    reload,
    reloadCustom,
  };
}
