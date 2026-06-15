import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Pencil, RefreshCw, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import LunchAddSpotForm from '../components/LunchAddSpotForm';
import LunchOriginSettings from '../components/LunchOriginSettings';
import {
  DEFAULT_LUNCH_FILTERS,
  HISTORY_SKIP_DAYS_OPTIONS,
  LUNCH_SESSION_EXCLUDE_KEY,
  LUNCH_TAGS,
  LUNCH_ALLOWANCE_WON,
  LUNCH_PRICE_OVER,
  LUNCH_PRICE_UNKNOWN,
  LUNCH_PRICE_WITHIN,
  PRICE_LEVELS,
  WALK_MAX_OPTIONS,
} from '../constants/lunchPick';
import { useLunchCustomSpots } from '../hooks/useLunchCustomSpots';
import { useLunchHistory } from '../hooks/useLunchHistory';
import { formatRadiusKm, usesYeouidoSeedCatalog } from '../constants/lunchOrigins';
import { useLunchOrigin } from '../hooks/useLunchOrigin';
import { useLunchNearbySpots } from '../hooks/useLunchNearbySpots';
import { useLunchSpots } from '../hooks/useLunchSpots';
import {
  buildHistoryExcludeIds,
  kakaoPlaceToSpot,
  recommendLunch,
} from '../utils/lunchRecommend';
import { searchKakaoLocal } from '../utils/lunchKakaoApi';
import { getCategoryVisual } from '../utils/lunchCategoryVisual';
import { enrichSpotWithPriceInfo, formatMenuPrice } from '../utils/lunchMenuPrice';
import './LunchPickPage.css';

const TABS = [
  { id: 'today', label: '오늘', emoji: '🍽️' },
  { id: 'catalog', label: '단골', emoji: '⭐' },
  { id: 'search', label: '검색', emoji: '🔍' },
  { id: 'register', label: '등록', emoji: '➕' },
];

function readSessionExclude() {
  try {
    const raw = sessionStorage.getItem(LUNCH_SESSION_EXCLUDE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function priceLabel(level) {
  if (level === LUNCH_PRICE_WITHIN) return `${LUNCH_ALLOWANCE_WON.toLocaleString('ko-KR')}원 이내`;
  if (level === LUNCH_PRICE_OVER) return `${LUNCH_ALLOWANCE_WON.toLocaleString('ko-KR')}원 초과`;
  if (level === LUNCH_PRICE_UNKNOWN) return '식대 미확인';
  return '';
}

function SpotCard({
  spot,
  variant = 'alt',
  onVisit,
  onExclude,
  onMap,
  onAddToCatalog,
  onEdit,
  onRemove,
}) {
  const priced = enrichSpotWithPriceInfo(spot);
  const visual = getCategoryVisual(priced.category, priced.tags);
  const isPrimary = variant === 'primary';
  const displayLevel = priced.priceLevel;

  return (
    <article
      className={`lunch-card lunch-card--${variant}`}
      style={{ '--lunch-card-accent': visual.accent }}
    >
      <div
        className="lunch-card__hero"
        style={{ background: visual.gradient }}
        aria-hidden
      >
        <span className="lunch-card__hero-emoji">{visual.emoji}</span>
        {isPrimary && (
          <span className="lunch-card__pick-badge">
            <Sparkles size={14} aria-hidden />
            오늘의 픽
          </span>
        )}
        {!isPrimary && variant === 'alt' && (
          <span className="lunch-card__alt-badge">다른 선택</span>
        )}
      </div>

      <div className="lunch-card__body">
        <div className="lunch-card__head">
          <h3>{priced.name}</h3>
          {priced.source === 'kakao' && <span className="lunch-card__badge">검색</span>}
          {priced.source === 'custom' && (
            <span className="lunch-card__badge lunch-card__badge--custom">등록</span>
          )}
        </div>

        <div className="lunch-card__chips">
          <span className="lunch-card__chip lunch-card__chip--category">{priced.category}</span>
          {priced.walkMinutes != null && (
            <span className="lunch-card__chip">🚶 도보 {priced.walkMinutes}분</span>
          )}
          {(displayLevel === LUNCH_PRICE_WITHIN ||
            displayLevel === LUNCH_PRICE_OVER ||
            displayLevel === LUNCH_PRICE_UNKNOWN) && (
            <span
              className={`lunch-card__chip${
                displayLevel === LUNCH_PRICE_WITHIN
                  ? ' lunch-card__chip--budget'
                  : displayLevel === LUNCH_PRICE_UNKNOWN
                    ? ' lunch-card__chip--unknown'
                    : ''
              }`}
            >
              {priceLabel(displayLevel)}
            </span>
          )}
        </div>

        {priced.exitHint && <p className="lunch-card__hint">{priced.exitHint}</p>}
        {priced.representativeMenu && displayLevel === LUNCH_PRICE_WITHIN && (
          <p className="lunch-card__menu">
            <span className="lunch-card__menu-label">
              대표 메뉴 (식대 이내)
              {priced.priceIsEstimated ? ' · 추정' : ''}
            </span>
            {priced.representativeMenu.name}
            {priced.representativeMenu.priceWon != null &&
              ` · ${formatMenuPrice(priced.representativeMenu.priceWon)}`}
          </p>
        )}
        {priced.representativeMenu && displayLevel === LUNCH_PRICE_OVER && (
          <p className="lunch-card__menu">
            <span className="lunch-card__menu-label">참고 메뉴 (식대 초과)</span>
            {priced.representativeMenu.name}
            {priced.representativeMenu.priceWon != null
              ? ` · ${formatMenuPrice(priced.representativeMenu.priceWon)}`
              : ''}
          </p>
        )}
        {!priced.representativeMenu &&
          priced.menuHints?.length > 0 &&
          displayLevel === LUNCH_PRICE_UNKNOWN && (
            <p className="lunch-card__menu">
              <span className="lunch-card__menu-label">메뉴</span>
              {priced.menuHints.join(' · ')}
              <span className="lunch-card__menu-note"> (가격 미입력 — 등록 시 메뉴·가격 추가 가능)</span>
            </p>
          )}
        {!priced.representativeMenu &&
          priced.menuHints?.length > 0 &&
          displayLevel !== LUNCH_PRICE_UNKNOWN && (
            <p className="lunch-card__menu">
              <span className="lunch-card__menu-label">추천 메뉴</span>
              {priced.menuHints.join(' · ')}
            </p>
          )}
        {priced.teamNote && <p className="lunch-card__note">{priced.teamNote}</p>}
        {priced.tags?.length > 0 && (
          <div className="lunch-card__tags">
            {priced.tags.map((t) => (
              <span key={t} className="lunch-tag">
                {LUNCH_TAGS[t]?.emoji} {LUNCH_TAGS[t]?.label || t}
              </span>
            ))}
          </div>
        )}

        <div className="lunch-card__actions">
          {onVisit && (
            <button type="button" className="lunch-btn lunch-btn--primary" onClick={() => onVisit(spot)}>
              갔어요
            </button>
          )}
          {onExclude && (
            <button type="button" className="lunch-btn lunch-btn--soft" onClick={() => onExclude(spot)}>
              제외
            </button>
          )}
          {onAddToCatalog && (
            <button type="button" className="lunch-btn lunch-btn--soft" onClick={() => onAddToCatalog(spot)}>
              단골에 추가
            </button>
          )}
          {onEdit && (
            <button type="button" className="lunch-btn lunch-btn--soft" onClick={() => onEdit(spot)}>
              <Pencil size={14} aria-hidden />
              수정
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="lunch-btn lunch-btn--ghost lunch-card__remove"
              onClick={() => onRemove(spot)}
              aria-label={`${spot.name} 삭제`}
            >
              <Trash2 size={14} aria-hidden />
              삭제
            </button>
          )}
          {spot.mapUrl && (
            <a
              className="lunch-btn lunch-btn--map"
              href={spot.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onMap}
            >
              <MapPin size={14} aria-hidden />
              지도
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function LunchPickPage() {
  const { spots: seedAndCustomSpots, meta, loading, error, reloadCustom } = useLunchSpots();
  const { history, markVisited, clearHistory } = useLunchHistory();
  const {
    origin,
    stored,
    setPreset,
    setCustomOrigin,
    resetOrigin,
    presets,
    customPresetId,
  } = useLunchOrigin();
  const useSeedCatalog = usesYeouidoSeedCatalog(origin);
  const {
    nearby: nearbySpots,
    loading: nearbyLoading,
    error: nearbyError,
    available: nearbyKakaoAvailable,
  } = useLunchNearbySpots(origin, useSeedCatalog);
  const { addSpot, removeSpot } = useLunchCustomSpots();

  const seedSpots = useMemo(
    () => seedAndCustomSpots.filter((s) => s.source !== 'custom'),
    [seedAndCustomSpots]
  );
  const customSpotsList = useMemo(
    () => seedAndCustomSpots.filter((s) => s.source === 'custom'),
    [seedAndCustomSpots]
  );

  /** 오늘 추천·필터용 */
  const spots = useMemo(() => {
    if (useSeedCatalog) return seedAndCustomSpots;
    const seen = new Set();
    const merged = [];
    for (const s of [...nearbySpots, ...customSpotsList]) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
    return merged;
  }, [useSeedCatalog, seedAndCustomSpots, nearbySpots, customSpotsList]);

  /** 단골 탭: 팀 시드는 기준 위치와 무관하게 항상 표시 + 주변(카카오) + 내 등록 */
  const catalogSpots = useMemo(() => {
    const seen = new Set();
    const merged = [];
    const sources = useSeedCatalog
      ? seedAndCustomSpots
      : [...seedSpots, ...nearbySpots, ...customSpotsList];
    for (const s of sources) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
    return merged;
  }, [useSeedCatalog, seedAndCustomSpots, seedSpots, nearbySpots, customSpotsList]);

  const spotsLoading = loading || (!useSeedCatalog && nearbyLoading);

  const [tab, setTab] = useState('today');
  const [showOriginSettings, setShowOriginSettings] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_LUNCH_FILTERS);
  const [sessionExclude, setSessionExclude] = useState(() => new Set(readSessionExclude()));
  const [pick, setPick] = useState({ primary: null, alternatives: [], poolSize: 0 });
  const [catalogQuery, setCatalogQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState(() => origin.searchHint || '파크원타워 맛집');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [kakaoAvailable, setKakaoAvailable] = useState(true);
  const [registerToast, setRegisterToast] = useState('');

  const [editingSpot, setEditingSpot] = useState(null);

  useEffect(() => {
    setSearchQuery(origin.searchHint || '맛집');
  }, [origin.id, origin.searchHint]);

  const persistSessionExclude = useCallback((set) => {
    setSessionExclude((prev) => {
      const next = typeof set === 'function' ? set(prev) : set;
      sessionStorage.setItem(LUNCH_SESSION_EXCLUDE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const historyExclude = useMemo(
    () => buildHistoryExcludeIds(Object.keys(history), history, filters.historySkipDays),
    [history, filters.historySkipDays]
  );

  const spotsForPick = useMemo(
    () => spots.map((s) => enrichSpotWithPriceInfo(s)),
    [spots]
  );

  const runPick = useCallback(() => {
    const excludeIds = new Set([...sessionExclude, ...historyExclude]);
    const result = recommendLunch(spotsForPick, { ...filters, excludeIds }, sessionExclude);
    setPick(result);
  }, [spotsForPick, filters, sessionExclude, historyExclude]);

  useEffect(() => {
    if (!spotsLoading && spotsForPick.length) runPick();
  }, [spotsLoading, spotsForPick, runPick]);

  useEffect(() => {
    if (!spotsLoading && !spots.length) {
      setPick({ primary: null, alternatives: [], poolSize: 0 });
    }
  }, [spotsLoading, spots.length]);

  const toggleTag = (tag) => {
    setFilters((f) => {
      const has = f.tags.includes(tag);
      return {
        ...f,
        tags: has ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
      };
    });
  };

  const handleExclude = (spot) => {
    persistSessionExclude((prev) => new Set([...prev, spot.id]));
    runPick();
  };

  const handleVisit = (spot) => {
    markVisited(spot.id);
    runPick();
  };

  const handleAddSpot = useCallback(
    (input) => {
      const spot = addSpot(input);
      if (spot) {
        reloadCustom();
      }
      return spot;
    },
    [addSpot, reloadCustom]
  );

  const handleRemoveCustom = useCallback(
    (spot) => {
      if (!window.confirm(`「${spot.name}」을(를) 등록 목록에서 삭제할까요?`)) return;
      removeSpot(spot.id);
      reloadCustom();
    },
    [removeSpot, reloadCustom]
  );

  const editInitialFromSpot = useCallback((spot) => {
    const repMenu = spot.menus?.[0];
    return {
      id: spot.id,
      addedAt: spot.addedAt || '',
      name: spot.name || '',
      category: spot.category || '한식',
      priceLevel: spot.priceLevel || LUNCH_PRICE_WITHIN,
      walkMinutes: String(spot.walkMinutes ?? 5),
      exitHint: spot.exitHint || '',
      menuHints: (spot.menuHints || []).join(', '),
      repMenuName: repMenu?.name || '',
      repMenuPrice: repMenu?.priceWon ? String(repMenu.priceWon) : '',
      mapUrl: spot.mapUrl || '',
      teamNote: spot.teamNote || '',
      weight: String(spot.weight ?? 1),
      tags: Array.isArray(spot.tags) ? spot.tags : [],
    };
  }, []);

  const handleSaveEdit = useCallback(
    (input) => {
      if (!editingSpot) return null;
      const saved = handleAddSpot({
        ...input,
        id: editingSpot.id,
        addedAt: editingSpot.addedAt,
      });
      if (saved) {
        setEditingSpot(null);
        setRegisterToast(`「${saved.name}」 정보를 수정했습니다.`);
      }
      return saved;
    },
    [editingSpot, handleAddSpot]
  );

  const handleStartEdit = useCallback((spot) => {
    setEditingSpot(spot);
  }, []);

  const handleAddFromSearch = useCallback(
    (spot) => {
      const added = handleAddSpot({
        name: spot.name,
        category: spot.category || '기타',
        priceLevel:
          spot.priceLevel === LUNCH_PRICE_OVER
            ? LUNCH_PRICE_OVER
            : spot.priceLevel === LUNCH_PRICE_WITHIN
              ? LUNCH_PRICE_WITHIN
              : LUNCH_PRICE_UNKNOWN,
        walkMinutes: spot.walkMinutes || 5,
        exitHint: spot.exitHint || spot.address || '',
        mapUrl: spot.mapUrl || '',
        menuHints: spot.menuHints || [],
        tags: spot.tags || [],
      });
      if (added) setRegisterToast(`「${added.name}」을(를) 단골에 추가했습니다.`);
    },
    [handleAddSpot]
  );

  const runSearch = async () => {
    setSearchLoading(true);
    setSearchError(null);
    const res = await searchKakaoLocal({
      query: searchQuery,
      lat: origin.center.lat,
      lng: origin.center.lng,
      radius: origin.radiusM,
    });
    setKakaoAvailable(res.available);
    setSearchError(res.error || null);
    setSearchResults(res.places.map(kakaoPlaceToSpot));
    setSearchLoading(false);
  };

  const catalogFiltered = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return catalogSpots;
    return catalogSpots.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.menuHints || []).some((m) => m.toLowerCase().includes(q))
    );
  }, [catalogSpots, catalogQuery]);

  const seedCount = meta?.spotCount ?? seedSpots.length;
  const customCount = customSpotsList.length;
  const catalogCount = catalogSpots.length;

  return (
    <main className="lunch-pick-main">
      <header className="lunch-pick-header">
        <div className="lunch-pick-header__brand">
          <span className="lunch-pick-header__icon" aria-hidden>
            🍱
          </span>
          <div>
            <h1>오늘 뭐 먹지</h1>
            <p className="lunch-pick-header__tagline">{origin.label} 점심, 한 번에 골라요</p>
          </div>
        </div>
        <div className="lunch-pick-stats">
          <span className="lunch-pick-stat">
            <strong>{origin.label}</strong>
            <small>기준 위치</small>
          </span>
          <span className="lunch-pick-stat">
            <strong>{catalogCount}</strong>
            <small>단골 맛집</small>
          </span>
          <span className="lunch-pick-stat lunch-pick-stat--accent">
            <strong>{(LUNCH_ALLOWANCE_WON / 1000).toFixed(0)}k</strong>
            <small>식대 기준</small>
          </span>
        </div>
        <p className="lunch-pick-lead">
          반경 {formatRadiusKm(origin.radiusM)}
          {customCount > 0 && ` · 내 등록 ${customCount}곳`}
        </p>
        <button
          type="button"
          className="lunch-pick-settings-toggle"
          onClick={() => setShowOriginSettings((v) => !v)}
          aria-expanded={showOriginSettings}
        >
          <Settings2 size={14} aria-hidden />
          {showOriginSettings ? '기준 위치 닫기' : '기준 위치 변경'}
        </button>
      </header>

      {showOriginSettings && (
        <div className="lunch-pick-panel lunch-pick-panel--settings">
          <LunchOriginSettings
            origin={origin}
            stored={stored}
            presets={presets}
            customPresetId={customPresetId}
            setPreset={setPreset}
            setCustomOrigin={setCustomOrigin}
            resetOrigin={resetOrigin}
          />
        </div>
      )}

      {registerToast && (
        <p className="lunch-pick-toast" role="status">
          {registerToast}
          <button type="button" className="lunch-pick-toast__dismiss" onClick={() => setRegisterToast('')}>
            닫기
          </button>
        </p>
      )}

      {!kakaoAvailable && tab === 'search' && (
        <p className="lunch-pick-banner" role="status">
          카카오 지도 검색 API가 설정되지 않았습니다. 단골 목록·오늘 추천은 그대로 사용할 수 있습니다.
        </p>
      )}

      {useSeedCatalog && !spotsLoading && seedSpots.length === 0 && !error && (
        <p className="lunch-pick-banner" role="alert">
          팀 맛집 시드(JSON)를 불러오지 못했습니다. 새로고침하거나 배포 경로를 확인해 주세요.
        </p>
      )}

      {!useSeedCatalog && tab === 'today' && !spotsLoading && (
        <p className="lunch-pick-banner lunch-pick-banner--info" role="status">
          {nearbyKakaoAvailable ? (
            <>
              <strong>{origin.label}</strong> 반경 {formatRadiusKm(origin.radiusM)} 주변 맛집{' '}
              {nearbySpots.length}곳 (오늘 추천). 단골 탭에는 팀 시드 {seedSpots.length}곳이 그대로
              있습니다.
            </>
          ) : (
            <>
              카카오 API가 필요합니다. <strong>{origin.label}</strong> 주변 추천은 검색·등록으로
              채우고, 단골 탭에서 팀 시드 {seedSpots.length}곳을 확인하세요.
            </>
          )}
          {nearbySpots.length === 0 && seedSpots.length > 0 && (
            <>
              {' '}
              파크원·여의도역이면 상단 <strong>오케스트로 (파크원타워2)</strong> 프리셋을 눌러
              보세요.
            </>
          )}
          {nearbyError && ` (${nearbyError})`}
        </p>
      )}

      {stored?.presetId === 'custom' && useSeedCatalog && tab === 'today' && !spotsLoading && (
        <p className="lunch-pick-banner lunch-pick-banner--info" role="status">
          좌표가 여의도 근처라 <strong>팀 시드 목록</strong>으로 추천합니다. 프리셋{' '}
          <strong>오케스트로 (파크원타워2)</strong>를 누르면 설정이 더 분명해집니다.
        </p>
      )}

      <nav className="lunch-pick-tabs" aria-label="점심 메뉴">
        <div className="lunch-pick-tabs__track">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`lunch-pick-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-label={t.label}
            >
              <span className="lunch-pick-tab__emoji" aria-hidden>
                {t.emoji}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {spotsLoading && <p className="lunch-pick-status">맛집 목록 불러오는 중…</p>}
      {error && (
        <p className="lunch-pick-status lunch-pick-status--error" role="alert">
          {error}
        </p>
      )}

      {!spotsLoading && !error && tab === 'today' && (
        <div className="lunch-pick-panel">
          <section className="lunch-filters" aria-label="필터">
            <p className="lunch-filters__title">오늘 조건</p>
            <div className="lunch-filters__row">
              <label>
                식대 (13,000원)
                <select
                  value={filters.priceLevel}
                  onChange={(e) => setFilters((f) => ({ ...f, priceLevel: Number(e.target.value) }))}
                  className="form-input"
                >
                  {PRICE_LEVELS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                도보
                <select
                  value={filters.maxWalkMinutes}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, maxWalkMinutes: Number(e.target.value) }))
                  }
                  className="form-input"
                >
                  {WALK_MAX_OPTIONS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                최근 방문
                <select
                  value={filters.historySkipDays}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, historySkipDays: Number(e.target.value) }))
                  }
                  className="form-input"
                >
                  {HISTORY_SKIP_DAYS_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="lunch-filters__tags">
              {Object.entries(LUNCH_TAGS).map(([key, { label, emoji }]) => (
                <button
                  key={key}
                  type="button"
                  className={`lunch-tag-btn${filters.tags.includes(key) ? ' is-on' : ''}`}
                  onClick={() => toggleTag(key)}
                >
                  {emoji} {label}
                </button>
              ))}
            </div>
            <div className="lunch-filters__actions">
              <button type="button" className="lunch-btn lunch-btn--cta" onClick={runPick}>
                <RefreshCw size={18} aria-hidden />
                다시 뽑기
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  persistSessionExclude(new Set());
                  runPick();
                }}
              >
                제외 초기화
              </button>
              <button type="button" className="btn btn-ghost" onClick={clearHistory}>
                방문 기록 삭제
              </button>
            </div>
            <p className="lunch-filters__hint">
              후보 {pick.poolSize}곳 · 세션 제외 {sessionExclude.size}곳
            </p>
          </section>

          {pick.primary ? (
            <div className="lunch-results">
              <p className="lunch-results__notice" role="note">
                추천 식당은 실제 식당명과 식당을 찾을 수 있도록 도움을 주는 키워드 혼합으로
                구성되어 있습니다.
              </p>

              <SpotCard
                spot={pick.primary}
                variant="primary"
                onVisit={handleVisit}
                onExclude={handleExclude}
                onEdit={pick.primary.source === 'custom' ? handleStartEdit : undefined}
                onRemove={pick.primary.source === 'custom' ? handleRemoveCustom : undefined}
              />
              {pick.alternatives.length > 0 && (
                <>
                  <h2 className="lunch-results__heading">이것도 어때요?</h2>
                  <div className="lunch-alt-grid">
                    {pick.alternatives.map((s) => (
                      <SpotCard
                        key={s.id}
                        spot={s}
                        variant="alt"
                        onVisit={handleVisit}
                        onExclude={handleExclude}
                        onEdit={s.source === 'custom' ? handleStartEdit : undefined}
                        onRemove={s.source === 'custom' ? handleRemoveCustom : undefined}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="lunch-empty" role="status">
              <span className="lunch-empty__emoji" aria-hidden>
                🥲
              </span>
              <p className="lunch-empty__title">조건에 맞는 맛집이 없어요</p>
              <p className="lunch-empty__hint">
                {!useSeedCatalog && !nearbyKakaoAvailable
                  ? '카카오 API 키를 설정하거나 검색 탭에서 맛집을 찾아 단골에 추가해 보세요. 단골 탭에 팀 시드가 남아 있을 수 있습니다.'
                  : '필터를 완화하거나 제외·방문 기록을 초기화해 보세요. 반경(km)을 넓혀도 됩니다.'}
                {seedSpots.length > 0 && !useSeedCatalog && (
                  <>
                    {' '}
                    여의도라면 기준 위치에서 <strong>오케스트로 (파크원타워2)</strong> 프리셋을
                    선택하세요.
                  </>
                )}
                {customCount === 0 && (
                  <>
                    {' '}
                    개발 서버는 <strong>localhost:3000</strong> 고정입니다. 다른 포트로
                    접속하면 등록한 단골은 origin마다 따로 저장됩니다.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {!spotsLoading && !error && tab === 'catalog' && (
        <div className="lunch-pick-panel">
          <p className="lunch-catalog-intro">
            {useSeedCatalog ? (
              <>
                팀 시드 {seedCount}곳
                {customCount > 0 && ` + 내가 등록 ${customCount}곳`}
              </>
            ) : (
              <>
                {origin.label} 주변 {nearbySpots.length}곳
                {customCount > 0 && ` + 내가 등록 ${customCount}곳`}
              </>
            )}
          </p>
          <input
            type="search"
            className="form-input lunch-catalog-search"
            placeholder="이름·메뉴·종류 검색"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
          />
          <div className="lunch-catalog-grid">
            {catalogFiltered.map((s) => (
              <SpotCard
                key={s.id}
                spot={s}
                variant="alt"
                onVisit={(spot) => markVisited(spot.id)}
                onEdit={s.source === 'custom' ? handleStartEdit : undefined}
                onRemove={s.source === 'custom' ? handleRemoveCustom : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {!spotsLoading && tab === 'search' && (
        <div className="lunch-pick-panel">
          <p className="lunch-search-hint">
            검색 중심: {origin.label} · 반경 {formatRadiusKm(origin.radiusM)}
          </p>
          <div className="lunch-search-bar">
            <input
              type="search"
              className="form-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="예: 파크원타워 맛집, 국밥"
            />
            <button type="button" className="btn btn-primary" onClick={runSearch} disabled={searchLoading}>
              검색
            </button>
          </div>
          {searchLoading && <p className="lunch-pick-status">검색 중…</p>}
          {searchError && (
            <p className="lunch-pick-status lunch-pick-status--error">{searchError}</p>
          )}
          <div className="lunch-catalog-grid">
            {searchResults.map((s) => (
              <SpotCard
                key={s.id}
                spot={s}
                variant="alt"
                onAddToCatalog={handleAddFromSearch}
              />
            ))}
          </div>
        </div>
      )}

      {!spotsLoading && tab === 'register' && (
        <div className="lunch-pick-panel">
          <h2 className="lunch-register-title">신규 식당 등록</h2>
          <p className="lunch-register-lead">
            등록한 식당은 이 브라우저의 단골 목록에 합쳐집니다. 팀 공유는 JSON 백업 후 시드 파일에 반영하세요.
          </p>
          <LunchAddSpotForm
            onAdd={handleAddSpot}
            submitLabel="단골에 등록"
            searchCenter={{
              lat: origin.center.lat,
              lng: origin.center.lng,
              radiusM: origin.radiusM,
            }}
          />
        </div>
      )}

      {editingSpot && (
        <div
          className="lunch-edit-drawer-overlay"
          role="presentation"
          onClick={() => setEditingSpot(null)}
        >
          <aside
            className="lunch-edit-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="단골 식당 수정"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="lunch-edit-drawer__header">
              <div className="lunch-edit-drawer__title">단골 식당 수정</div>
              <button
                type="button"
                className="lunch-edit-drawer__close"
                onClick={() => setEditingSpot(null)}
                aria-label="닫기"
              >
                <X size={16} aria-hidden />
              </button>
            </header>
            <div className="lunch-edit-drawer__body">
              <LunchAddSpotForm
                key={editingSpot.id}
                initial={editInitialFromSpot(editingSpot)}
                onAdd={handleSaveEdit}
                submitLabel="수정 저장"
                onCancel={() => setEditingSpot(null)}
                searchCenter={{
                  lat: origin.center.lat,
                  lng: origin.center.lng,
                  radiusM: origin.radiusM,
                }}
              />
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
