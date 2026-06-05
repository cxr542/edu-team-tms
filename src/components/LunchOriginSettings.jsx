import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import {
  formatRadiusKm,
  isNearYeouidoPreset,
  kmToRadiusM,
  LUNCH_ORIGIN_PRESETS,
  radiusMToKm,
} from '../constants/lunchOrigins';
import { lookupKakaoCoordsByName } from '../utils/lunchKakaoApi';

/**
 * @param {{
 *   origin: import('../constants/lunchOrigins').LunchOriginPreset,
 *   stored: import('../hooks/useLunchOrigin').StoredOrigin | null,
 *   presets: import('../constants/lunchOrigins').LunchOriginPreset[],
 *   customPresetId: string,
 *   setPreset: (id: string) => void,
 *   setCustomOrigin: (o: { label: string, lat: number, lng: number, radiusM: number }) => void,
 *   resetOrigin: () => void,
 * }} props
 */
export default function LunchOriginSettings({
  origin,
  stored,
  presets,
  customPresetId,
  setPreset,
  setCustomOrigin,
  resetOrigin,
}) {
  const activeId = stored?.presetId || presets[0]?.id;
  const isCustom = activeId === customPresetId;

  const [customLabel, setCustomLabel] = useState(stored?.customLabel || '');
  const [customLat, setCustomLat] = useState(String(stored?.customLat ?? origin.center.lat));
  const [customLng, setCustomLng] = useState(String(stored?.customLng ?? origin.center.lng));
  const [customRadiusKm, setCustomRadiusKm] = useState(
    String(radiusMToKm(stored?.customRadiusM ?? origin.radiusM))
  );
  const [geoStatus, setGeoStatus] = useState('idle');
  const [geoHint, setGeoHint] = useState('');
  const debounceRef = useRef(null);
  const skipNextGeo = useRef(false);

  useEffect(() => {
    skipNextGeo.current = true;
    setCustomLabel(isCustom ? stored?.customLabel || '' : origin.label);
    setCustomLat(String(origin.center.lat));
    setCustomLng(String(origin.center.lng));
    setCustomRadiusKm(String(radiusMToKm(origin.radiusM)));
    setGeoStatus('idle');
    setGeoHint('');
  }, [
    isCustom,
    stored?.customLabel,
    stored?.customLat,
    stored?.customLng,
    stored?.customRadiusM,
    origin.id,
    origin.label,
    origin.center.lat,
    origin.center.lng,
    origin.radiusM,
  ]);

  const runGeoLookup = useCallback(
    async (nameOverride) => {
      const q = String(nameOverride ?? customLabel).trim();
      if (q.length < 2) {
        setGeoStatus('idle');
        setGeoHint('');
        return;
      }

      setGeoStatus('loading');
      setGeoHint('카카오에서 위치를 찾는 중…');

      const biasLat = parseFloat(customLat);
      const biasLng = parseFloat(customLng);
      const res = await lookupKakaoCoordsByName({
        name: q,
        lat: Number.isFinite(biasLat) ? biasLat : undefined,
        lng: Number.isFinite(biasLng) ? biasLng : undefined,
      });

      if (!res.available) {
        setGeoStatus('unavailable');
        setGeoHint(
          'KAKAO_REST_API_KEY 미설정 — 위·경도를 직접 입력하거나 키를 설정해 주세요.'
        );
        return;
      }
      if (res.error || res.lat == null || res.lng == null) {
        setGeoStatus(/appKey|REST API/i.test(res.error || '') ? 'error' : 'none');
        setGeoHint(
          res.error || '검색 결과가 없습니다. 이름을 바꾸거나 좌표를 직접 입력하세요.'
        );
        return;
      }

      setCustomLat(String(res.lat));
      setCustomLng(String(res.lng));
      setGeoStatus('ok');
      setGeoHint(
        res.placeName && res.placeName !== q
          ? `「${res.placeName}」 좌표를 반영했습니다.`
          : '위·경도를 반영했습니다.'
      );
    },
    [customLabel, customLat, customLng]
  );

  useEffect(() => {
    if (skipNextGeo.current) {
      skipNextGeo.current = false;
      return undefined;
    }

    clearTimeout(debounceRef.current);
    const q = customLabel.trim();
    if (q.length < 2) {
      setGeoStatus('idle');
      setGeoHint('');
      return undefined;
    }

    debounceRef.current = setTimeout(() => {
      runGeoLookup(q);
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [customLabel, runGeoLookup]);

  const applyCustom = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const label = customLabel.trim() || '직접 지정';
    const radiusM = kmToRadiusM(customRadiusKm);
    const center = { lat, lng };

    const matchedPreset = LUNCH_ORIGIN_PRESETS.find(
      (p) => isNearYeouidoPreset(center) && p.label === label
    );
    if (matchedPreset) {
      setPreset(matchedPreset.id);
      setGeoHint(`${matchedPreset.label} 프리셋으로 적용했습니다.`);
      setGeoStatus('ok');
      return;
    }

    setCustomOrigin({ label, lat, lng, radiusM });
    setGeoHint('기준 위치를 적용했습니다.');
    setGeoStatus('ok');
  };

  return (
    <section className="lunch-origin-settings" aria-label="기준 위치">
      <h2 className="lunch-origin-settings__title">
        <MapPin size={16} aria-hidden />
        기준 위치
      </h2>
      <p className="lunch-origin-settings__current">
        현재: <strong>{origin.label}</strong> · 반경 {formatRadiusKm(origin.radiusM)} · (
        {origin.center.lat.toFixed(4)}, {origin.center.lng.toFixed(4)})
      </p>
      <div className="lunch-origin-settings__presets">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`lunch-origin-preset-btn${activeId === p.id ? ' is-active' : ''}`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={`lunch-origin-preset-btn${isCustom ? ' is-active' : ''}`}
          onClick={() => setPreset(customPresetId)}
        >
          직접 지정
        </button>
      </div>
      <p className="lunch-origin-settings__intro">
        프리셋을 누르면 바로 적용됩니다. 다른 위치는 아래에 이름·좌표를 입력한 뒤{' '}
        <strong>적용</strong>을 누르세요.
      </p>
      <div className="lunch-origin-custom-form">
          <p className="lunch-origin-custom-form__heading">직접 입력</p>
          <label>
            이름
            <div className="lunch-origin-custom-form__name-row">
              <input
                className="form-input"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="예: 발산역, 오케스트로 본사"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm lunch-origin-lookup-btn"
                onClick={() => runGeoLookup()}
                disabled={geoStatus === 'loading'}
              >
                <Search size={14} aria-hidden />
                위치 찾기
              </button>
            </div>
          </label>
          {geoHint && (
            <p
              className={`lunch-origin-geo-hint lunch-origin-geo-hint--${geoStatus}`}
              role="status"
            >
              {geoHint}
            </p>
          )}
          <div className="lunch-origin-custom-form__row">
            <label>
              위도
              <input
                className="form-input"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
              />
            </label>
            <label>
              경도
              <input
                className="form-input"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
              />
            </label>
            <label>
              반경(km)
              <input
                className="form-input"
                type="number"
                min={0.2}
                max={5}
                step={0.1}
                value={customRadiusKm}
                onChange={(e) => setCustomRadiusKm(e.target.value)}
              />
            </label>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={applyCustom}>
            직접 지정 적용
          </button>
        </div>
      <button type="button" className="btn btn-ghost btn-sm lunch-origin-reset" onClick={resetOrigin}>
        기준 위치 초기화 (파크원타워2)
      </button>
    </section>
  );
}
