import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Search } from 'lucide-react';
import {
  LUNCH_ALLOWANCE_WON,
  LUNCH_PRICE_OVER,
  LUNCH_PRICE_WITHIN,
  LUNCH_TAGS,
} from '../constants/lunchPick';
import { buildKakaoMapSearchUrl, lookupKakaoPlaceByName } from '../utils/lunchKakaoApi';

const EMPTY = {
  id: '',
  addedAt: '',
  name: '',
  category: '한식',
  priceLevel: LUNCH_PRICE_WITHIN,
  walkMinutes: '5',
  exitHint: '',
  menuHints: '',
  repMenuName: '',
  repMenuPrice: '',
  mapUrl: '',
  teamNote: '',
  weight: '1',
  tags: [],
};

/** @param {{ name?: string, category?: string, address?: string, mapUrl?: string, walkMinutes?: number }} place */
function applyKakaoPlaceToForm(place) {
  return {
    category: place.category || '음식점',
    walkMinutes: String(place.walkMinutes ?? 5),
    exitHint: place.address || '',
    mapUrl: place.mapUrl || '',
  };
}

/**
 * @param {{
 *   onAdd: (spot: object) => { id?: string, name: string } | null,
 *   initial?: Partial<typeof EMPTY>,
 *   onCancel?: () => void,
 *   submitLabel?: string,
 *   searchCenter?: { lat: number, lng: number, radiusM?: number },
 * }} props
 */
export default function LunchAddSpotForm({
  onAdd,
  initial,
  onCancel,
  submitLabel = '단골에 등록',
  searchCenter,
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [message, setMessage] = useState('');
  const [mapLookupStatus, setMapLookupStatus] = useState('idle'); // idle | loading | ok | pick | none | error | unavailable
  const [mapSuggestions, setMapSuggestions] = useState([]);
  const [mapLookupHint, setMapLookupHint] = useState('');
  const skipNextLookup = useRef(false);
  const debounceRef = useRef(null);

  const toggleTag = (key) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(key) ? f.tags.filter((t) => t !== key) : [...f.tags, key],
    }));
  };

  const pickPlace = useCallback((place, { silent = false } = {}) => {
    const patch = applyKakaoPlaceToForm(place);
    setForm((f) => ({
      ...f,
      name: place.name || f.name,
      ...patch,
    }));
    setMapSuggestions([]);
    setMapLookupStatus('ok');
    if (!silent) {
      setMapLookupHint('지도 URL을 채웠습니다. 필요하면 수정하세요.');
    }
  }, []);

  const runMapLookup = useCallback(
    async (nameOverride) => {
      const name = String(nameOverride ?? form.name).trim();
      if (name.length < 2) {
        setMapLookupStatus('idle');
        setMapSuggestions([]);
        setMapLookupHint('');
        return;
      }

      setMapLookupStatus('loading');
      setMapLookupHint('카카오 지도에서 장소를 찾는 중…');

      const res = await lookupKakaoPlaceByName({
        name,
        lat: searchCenter?.lat,
        lng: searchCenter?.lng,
        radius: searchCenter?.radiusM,
      });

      if (!res.available) {
        const searchUrl = buildKakaoMapSearchUrl(name);
        if (searchUrl) {
          setForm((f) => ({ ...f, mapUrl: searchUrl }));
        }
        setMapLookupStatus('unavailable');
        setMapSuggestions([]);
        setMapLookupHint(
          'KAKAO_REST_API_KEY 미설정 — 카카오맵 검색 링크를 넣었습니다. .env.local에 REST API 키를 넣고 dev 서버를 재시작하면 정확한 장소 URL·주소가 채워집니다.'
        );
        return;
      }
      if (res.error) {
        setMapLookupStatus('error');
        setMapSuggestions([]);
        setMapLookupHint(res.error);
        return;
      }
      if (!res.places?.length) {
        setMapLookupStatus('none');
        setMapSuggestions([]);
        setMapLookupHint('검색 결과가 없습니다. 이름을 바꾸거나 URL을 직접 입력하세요.');
        return;
      }

      setMapSuggestions(res.places);

      const normalized = name.replace(/\s/g, '').toLowerCase();
      const exactMatches = res.places.filter(
        (p) => p.name.replace(/\s/g, '').toLowerCase() === normalized
      );

      if (exactMatches.length === 1) {
        pickPlace(exactMatches[0]);
        return;
      }
      if (res.places.length === 1) {
        pickPlace(res.places[0]);
        return;
      }

      setMapLookupStatus('pick');
      setMapLookupHint(`${res.places.length}곳 찾음 — 아래에서 선택하면 지도 URL이 채워집니다.`);
    },
    [form.name, pickPlace, searchCenter]
  );

  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false;
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runMapLookup();
    }, 550);
    return () => clearTimeout(debounceRef.current);
  }, [form.name, runMapLookup]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const repName = form.repMenuName.trim();
    const repPrice = parseInt(form.repMenuPrice, 10);
    const menus =
      repName && Number.isFinite(repPrice) && repPrice > 0
        ? [{ name: repName, priceWon: repPrice }]
        : [];
    const menuHintsFromForm = String(form.menuHints || '')
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const menuHints =
      menuHintsFromForm.length > 0 ? menuHintsFromForm : menus.map((m) => m.name);
    let priceLevel = Number(form.priceLevel);
    if (menus.length) {
      priceLevel = menus[0].priceWon <= LUNCH_ALLOWANCE_WON ? LUNCH_PRICE_WITHIN : LUNCH_PRICE_OVER;
    }

    const spot = onAdd({
      id: form.id || undefined,
      addedAt: form.addedAt || undefined,
      name: form.name,
      category: form.category,
      priceLevel,
      walkMinutes: Number(form.walkMinutes),
      exitHint: form.exitHint,
      menuHints,
      menus,
      mapUrl: form.mapUrl,
      teamNote: form.teamNote,
      weight: Number(form.weight),
      tags: form.tags,
    });
    if (spot) {
      setMessage(`「${spot.name}」을(를) 등록했습니다.`);
      skipNextLookup.current = true;
      setForm({ ...EMPTY, tags: [] });
      setMapLookupStatus('idle');
      setMapSuggestions([]);
      setMapLookupHint('');
    } else {
      setMessage('식당 이름을 입력하세요.');
    }
  };

  return (
    <form className="lunch-add-form" onSubmit={handleSubmit}>
      <div className="lunch-add-form__grid">
        <label className="lunch-add-form__full lunch-add-form__name-field">
          식당 이름 *
          <div className="lunch-add-form__name-row">
            <input
              className="form-input"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onBlur={() => runMapLookup()}
              placeholder="예: OO국밥 여의도점"
              autoComplete="off"
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm lunch-add-form__lookup-btn"
              disabled={mapLookupStatus === 'loading' || form.name.trim().length < 2}
              onClick={() => runMapLookup()}
              title="카카오 지도에서 지도 URL 찾기"
            >
              <Search size={14} aria-hidden />
              {mapLookupStatus === 'loading' ? '검색 중…' : '지도 찾기'}
            </button>
          </div>
          {mapLookupHint && (
            <p
              className={`lunch-add-form__lookup-hint lunch-add-form__lookup-hint--${mapLookupStatus}`}
              role="status"
            >
              {mapLookupHint}
            </p>
          )}
          {mapSuggestions.length > 0 && mapLookupStatus === 'pick' && (
            <ul className="lunch-map-suggest" role="listbox" aria-label="카카오 장소 검색 결과">
              {mapSuggestions.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    className="lunch-map-suggest__item"
                    onClick={() => pickPlace(place)}
                  >
                    <span className="lunch-map-suggest__name">{place.name}</span>
                    <span className="lunch-map-suggest__addr">{place.address}</span>
                    {place.mapUrl && (
                      <span className="lunch-map-suggest__map">
                        <MapPin size={12} aria-hidden />
                        지도
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label>
          종류
          <input
            className="form-input"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
        </label>
        <label>
          식대
          <select
            className="form-input"
            value={form.priceLevel}
            onChange={(e) => setForm((f) => ({ ...f, priceLevel: Number(e.target.value) }))}
          >
            <option value={LUNCH_PRICE_WITHIN}>13,000원 이내</option>
            <option value={LUNCH_PRICE_OVER}>13,000원 초과</option>
          </select>
        </label>
        <label>
          도보(분)
          <input
            className="form-input"
            type="number"
            min={1}
            max={30}
            value={form.walkMinutes}
            onChange={(e) => setForm((f) => ({ ...f, walkMinutes: e.target.value }))}
          />
        </label>
        <label>
          추천 가중치
          <input
            className="form-input"
            type="number"
            min={0.1}
            max={3}
            step={0.1}
            value={form.weight}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
          />
        </label>
        <label className="lunch-add-form__full">
          찾아가는 길 / 출구
          <input
            className="form-input"
            value={form.exitHint}
            onChange={(e) => setForm((f) => ({ ...f, exitHint: e.target.value }))}
          />
        </label>
        <label>
          대표 메뉴 (식대 확인용)
          <input
            className="form-input"
            value={form.repMenuName}
            onChange={(e) => setForm((f) => ({ ...f, repMenuName: e.target.value }))}
            placeholder="예: 된장찌개"
          />
        </label>
        <label>
          메뉴 가격 (원)
          <input
            className="form-input"
            type="number"
            min={1000}
            step={500}
            value={form.repMenuPrice}
            onChange={(e) => setForm((f) => ({ ...f, repMenuPrice: e.target.value }))}
            placeholder="예: 9000"
          />
        </label>
        <label className="lunch-add-form__full">
          메뉴 힌트 (쉼표 구분, 선택)
          <input
            className="form-input"
            value={form.menuHints}
            onChange={(e) => setForm((f) => ({ ...f, menuHints: e.target.value }))}
          />
        </label>
        <label className="lunch-add-form__full">
          지도 URL
          <input
            className="form-input"
            type="url"
            value={form.mapUrl}
            onChange={(e) => setForm((f) => ({ ...f, mapUrl: e.target.value }))}
            placeholder="식당 이름 입력 시 자동 검색 · https://map.kakao.com/..."
          />
          {form.mapUrl && (
            <a
              className="lunch-add-form__map-preview"
              href={form.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={12} aria-hidden />
              지도 미리보기
            </a>
          )}
        </label>
        <label className="lunch-add-form__full">
          팀 메모
          <input
            className="form-input"
            value={form.teamNote}
            onChange={(e) => setForm((f) => ({ ...f, teamNote: e.target.value }))}
          />
        </label>
      </div>
      <div className="lunch-add-form__tags">
        {Object.entries(LUNCH_TAGS).map(([key, { label, emoji }]) => (
          <button
            key={key}
            type="button"
            className={`lunch-tag-btn${form.tags.includes(key) ? ' is-on' : ''}`}
            onClick={() => toggleTag(key)}
          >
            {emoji} {label}
          </button>
        ))}
      </div>
      <div className="lunch-add-form__actions">
        <button type="submit" className="btn btn-primary">
          <Plus size={16} aria-hidden />
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
      {message && <p className="lunch-add-form__msg">{message}</p>}
      <p className="lunch-add-form__hint">
        식당 이름을 입력하면 기준 위치 근처에서 카카오 지도 URL·주소·종류를 자동으로 채웁니다. API
        미설정 시 URL을 직접 입력하세요.
      </p>
    </form>
  );
}
