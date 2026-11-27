import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import LunchAddSpotForm from '../components/LunchAddSpotForm';
import LunchOriginSettings from '../components/LunchOriginSettings';
import {
  DEFAULT_LUNCH_FILTERS,
  HISTORY_SKIP_DAYS_OPTIONS,
  LUNCH_INCLUDE_KAKAO_KEY,
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
import { useLunchTeamSpots, useLunchTeamVisits } from '../hooks/useLunchTeamSpots';
import { useLunchVisits } from '../hooks/useLunchVisits';
import { findKpiMember } from '../constants/kpiMembers';
import {
  buildHistoryExcludeIds,
  kakaoPlaceToSpot,
  mergeKakaoIntoCatalog,
  recommendLunch,
} from '../utils/lunchRecommend';
import { probeKakaoLocal, searchKakaoLocal } from '../utils/lunchKakaoApi';
import { getCategoryVisual } from '../utils/lunchCategoryVisual';
import { enrichSpotWithPriceInfo, formatMenuPrice } from '../utils/lunchMenuPrice';
import {
  buildWeekView,
  findRegularSpots,
  isRegularSpot,
  mergeVisitHistory,
  REGULAR_DAYS,
  REGULAR_MIN_VISITS,
  regularOwners,
  regularsByMember,
  topVisitedSpots,
  visitsFromLegacyHistory,
} from '../utils/lunchVisits';

const REGULAR_RULE = `최근 ${REGULAR_DAYS}일 ${REGULAR_MIN_VISITS}회 이상`;

const normalizeSpotName = (name) => String(name || '').replace(/\s+/g, '').toLowerCase();

/** 구성원 코드 → 이름(성 뺀 부분, 예: 윤형) */
function memberShortName(code) {
  if (code === 'admin') return '관리자';
  const name = findKpiMember(code)?.displayName || code;
  return name.length >= 3 ? name.slice(1) : name;
}

/** @param {{ label?: string | null, compact?: boolean }} props label 예: '단골', '단골 · 우성', '우성 단골' */
function RegularBadge({ label = '단골', compact = false }) {
  if (!label) return null;
  return (
    <span className={`lunch-regular${compact ? ' lunch-regular--compact' : ''}`} title={`★ ${label} — ${REGULAR_RULE} 간 곳`}>
      ★{compact ? '' : ` ${label}`}
    </span>
  );
}
import './LunchPickPage.css';

const TABS = [
  { id: 'today', label: '추천' },
  { id: 'catalog', label: '식당' },
  { id: 'find', label: '찾기·등록' },
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
  regular = false,
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
          {regular && <RegularBadge label={regular} />}
          {priced.source === 'kakao' && <span className="lunch-card__badge">검색</span>}
          {priced.source === 'custom' && (
            <span className="lunch-card__badge lunch-card__badge--custom">이 브라우저</span>
          )}
          {priced.source === 'team' && (
            <span className="lunch-card__badge lunch-card__badge--custom">
              {memberShortName(priced.createdBy)} 등록
            </span>
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
              식당에 추가
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

/** 카드 한 줄 요약: 종류 · 도보 · 출구 */
function spotMetaLine(spot) {
  return [
    spot.category,
    spot.walkMinutes != null ? `도보 ${spot.walkMinutes}분` : '',
    spot.exitHint || '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** 대표 메뉴 한 줄(식대 이내면 가격까지) */
function spotMenuLine(spot) {
  const rep = spot.representativeMenu;
  if (rep) {
    const price = rep.priceWon != null ? ` ${formatMenuPrice(rep.priceWon)}` : '';
    return `${rep.name}${price}${spot.priceIsEstimated ? ' (추정)' : ''}`;
  }
  if (spot.menuHints?.length) return spot.menuHints.slice(0, 3).join(' · ');
  return '';
}

function PricePill({ level }) {
  if (level === LUNCH_PRICE_WITHIN) return <span className="lunch-pill lunch-pill--ok">식대 이내</span>;
  if (level === LUNCH_PRICE_OVER) return <span className="lunch-pill lunch-pill--over">식대 초과</span>;
  return <span className="lunch-pill">가격 미확인</span>;
}

/** C안 — 오늘의 픽 (가로형 카드) */
function PickHero({ spot, todayVisit, busy, regular = false, onChoose, onReroll, onExclude, onUndo, onEdit }) {
  const priced = enrichSpotWithPriceInfo(spot);
  const visual = getCategoryVisual(priced.category, priced.tags);
  const chosen = todayVisit?.spotId === spot.id;
  const menu = spotMenuLine(priced);

  return (
    <article className={`lunch-hero${chosen ? ' is-chosen' : ''}`} style={{ '--lunch-card-accent': visual.accent }}>
      <div className="lunch-hero__icon" style={{ background: visual.gradient }} aria-hidden>
        {visual.emoji}
      </div>
      <div className="lunch-hero__body">
        <p className="lunch-hero__eyebrow">
          <Sparkles size={13} aria-hidden />
          {chosen ? '오늘 점심으로 골랐어요' : '오늘의 픽'}
        </p>
        <h2 className="lunch-hero__name">
          {priced.name}
          {regular && <RegularBadge label={regular} />}
          {priced.source === 'custom' && <span className="lunch-pill lunch-pill--soft">이 브라우저</span>}
          {priced.source === 'team' && (
            <span className="lunch-pill lunch-pill--soft">{memberShortName(priced.createdBy)} 등록</span>
          )}
          {priced.source === 'kakao' && <span className="lunch-pill lunch-pill--soft">주변</span>}
        </h2>
        <p className="lunch-hero__meta">{spotMetaLine(priced)}</p>
        <div className="lunch-hero__menu">
          <PricePill level={priced.priceLevel} />
          {menu && <span>{menu}</span>}
        </div>
        {priced.teamNote && <p className="lunch-hero__note">“{priced.teamNote}”</p>}
        {priced.tags?.length > 0 && (
          <div className="lunch-hero__tags">
            {priced.tags.map((t) => (
              <span key={t} className="lunch-tag">
                {LUNCH_TAGS[t]?.emoji} {LUNCH_TAGS[t]?.label || t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="lunch-hero__actions">
        {chosen ? (
          <button type="button" className="lunch-btn lunch-btn--soft" onClick={onUndo} disabled={busy}>
            <Undo2 size={15} aria-hidden />
            선택 취소
          </button>
        ) : (
          <button type="button" className="lunch-btn lunch-btn--primary" onClick={() => onChoose(spot)} disabled={busy}>
            <Check size={15} aria-hidden />
            여기 갈래요
          </button>
        )}
        <button type="button" className="lunch-btn lunch-btn--soft" onClick={onReroll}>
          <RefreshCw size={15} aria-hidden />
          다시 뽑기
        </button>
        <div className="lunch-hero__minor">
          {spot.mapUrl && (
            <a className="lunch-link" href={spot.mapUrl} target="_blank" rel="noopener noreferrer">
              <MapPin size={13} aria-hidden />
              지도
            </a>
          )}
          {!chosen && (
            <button type="button" className="lunch-link" onClick={() => onExclude(spot)}>
              오늘은 제외
            </button>
          )}
          {onEdit && (
            <button type="button" className="lunch-link" onClick={() => onEdit(spot)}>
              <Pencil size={12} aria-hidden />
              수정
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** C안 — 대안 미니 카드 */
function AltMini({ spot, busy, regular = false, onChoose, onExclude }) {
  const priced = enrichSpotWithPriceInfo(spot);
  const visual = getCategoryVisual(priced.category, priced.tags);
  const menu = spotMenuLine(priced);
  return (
    <article className="lunch-mini">
      <div className="lunch-mini__head">
        <span className="lunch-mini__emoji" aria-hidden>
          {visual.emoji}
        </span>
        <div className="lunch-mini__title">
          <h3>
            {priced.name}
            {regular && <RegularBadge label={regular} compact />}
          </h3>
          <p>{[priced.category, priced.walkMinutes != null ? `${priced.walkMinutes}분` : ''].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {menu && <p className="lunch-mini__menu">{menu}</p>}
      <div className="lunch-mini__actions">
        <button type="button" className="lunch-link lunch-link--strong" onClick={() => onChoose(spot)} disabled={busy}>
          이걸로
        </button>
        <button type="button" className="lunch-link" onClick={() => onExclude(spot)}>
          제외
        </button>
        {spot.mapUrl && (
          <a className="lunch-link" href={spot.mapUrl} target="_blank" rel="noopener noreferrer">
            지도
          </a>
        )}
      </div>
    </article>
  );
}

/** C안 오른쪽 — 이번 주 점심 · 자주 간 곳 */
/** 이번 주 칸을 눌렀을 때 그 날 점심을 바로 고르는 작은 창 */
function WeekDayPicker({ day, catalog, top, busy, onRecord, onClear, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const options = useMemo(() => {
    if (q) {
      return catalog
        .filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.category || '').toLowerCase().includes(q) ||
            spotMenuLine(s).toLowerCase().includes(q)
        )
        .slice(0, 6);
    }
    // 검색 전에는 자주 간 곳부터 보여준다
    const byId = new Map(catalog.map((s) => [s.id, s]));
    const frequent = top.map((t) => byId.get(t.spotId) || { id: t.spotId, name: t.spotName, category: '' });
    const seen = new Set(frequent.map((s) => s.id));
    return [...frequent, ...catalog.filter((s) => !seen.has(s.id))].slice(0, 6);
  }, [q, catalog, top]);
  const exact = q && catalog.some((s) => s.name.toLowerCase() === q);

  const [, mm, dd] = day.key.split('-');
  return (
    <div
      className="lunch-daypick"
      role="dialog"
      aria-label={`${day.label}요일 점심 기록`}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="lunch-daypick__head">
        <strong>
          {Number(mm)}/{Number(dd)} ({day.label}) 점심
        </strong>
        <button type="button" className="lunch-daypick__close" onClick={onClose} aria-label="닫기">
          <X size={14} aria-hidden />
        </button>
      </div>
      <input
        ref={inputRef}
        type="search"
        className="form-input lunch-daypick__search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="식당 이름·종류로 찾기"
      />
      <ul className="lunch-daypick__list">
        {options.map((s) => (
          <li key={s.id}>
            <button type="button" disabled={busy} onClick={() => onRecord(s)}>
              <span>{s.name}</span>
              {s.category && <small>{s.category}</small>}
            </button>
          </li>
        ))}
        {q && !exact && (
          <li>
            <button
              type="button"
              className="is-manual"
              disabled={busy}
              onClick={() => onRecord({ id: `manual:${query.trim()}`, name: query.trim(), category: '' })}
            >
              <Plus size={12} aria-hidden />
              <span>「{query.trim()}」(으)로 기록</span>
            </button>
          </li>
        )}
        {!options.length && !q && <li className="lunch-daypick__empty">등록된 식당이 아직 없어요.</li>}
      </ul>
      {day.visit && (
        <button type="button" className="lunch-link lunch-daypick__clear" disabled={busy} onClick={onClear}>
          <Undo2 size={12} aria-hidden />
          이 날 기록 지우기
        </button>
      )}
    </div>
  );
}

function LunchSidePanel({ week, top, regulars = [], serverReady, canEdit, catalog, busy, onRecordDay, onClearDay, onFind }) {
  const [openKey, setOpenKey] = useState(null);
  const openDay = week.find((d) => d.key === openKey) || null;

  const record = async (spot) => {
    const ok = await onRecordDay(openDay, spot);
    if (ok) setOpenKey(null);
  };
  const clear = async () => {
    const ok = await onClearDay(openDay);
    if (ok) setOpenKey(null);
  };

  return (
    <aside className="lunch-side" aria-label="점심 기록">
      <section className="lunch-side__card">
        <h3 className="lunch-side__title">이번 주 점심</h3>
        <ol className="lunch-week">
          {week.map((d) => {
            const text = d.visit ? d.visit.spotName : d.isToday ? '?' : '–';
            const editable = canEdit && !d.isFuture;
            return (
              <li
                key={d.key}
                className={`lunch-week__day${d.isToday ? ' is-today' : ''}${d.isFuture ? ' is-future' : ''}${
                  openKey === d.key ? ' is-open' : ''
                }`}
              >
                <span className="lunch-week__label">{d.label}</span>
                {editable ? (
                  <button
                    type="button"
                    className="lunch-week__spot lunch-week__spot--btn"
                    title={d.visit ? `${d.visit.spotName} — 눌러서 바꾸기` : '눌러서 이 날 점심 기록'}
                    aria-expanded={openKey === d.key}
                    onClick={() => setOpenKey((k) => (k === d.key ? null : d.key))}
                  >
                    {text}
                  </button>
                ) : (
                  <span className="lunch-week__spot" title={d.visit?.spotName || ''}>
                    {text}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {openDay && (
          <WeekDayPicker
            key={openDay.key}
            day={openDay}
            catalog={catalog}
            top={top}
            busy={busy}
            onRecord={record}
            onClear={clear}
            onClose={() => setOpenKey(null)}
          />
        )}
        {!serverReady && (
          <p className="lunch-side__hint">서버 기록을 불러오지 못해 이 브라우저 기록으로 보여줘요.</p>
        )}
        {serverReady && canEdit && !openDay && (
          <p className="lunch-side__hint">칸을 누르면 그 날 점심을 바로 기록해요.</p>
        )}
      </section>

      <section className="lunch-side__card">
        <h3 className="lunch-side__title">
          자주 간 곳 <small>최근 120일</small>
        </h3>
        {top.length ? (
          <ul className="lunch-top">
            {top.map((t) => (
              <li key={t.spotId}>
                <span>
                  {t.spotName}
                  {isRegularSpot({ id: t.spotId, name: t.spotName }, regulars) && <RegularBadge compact />}
                </span>
                <span className="lunch-top__count">{t.count}회</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lunch-side__hint">「여기 갈래요」를 누르면 기록이 쌓여요.</p>
        )}
        <p className="lunch-side__hint">★ 단골: {REGULAR_RULE} 간 곳</p>
      </section>

      <button type="button" className="lunch-btn lunch-btn--soft lunch-side__find" onClick={onFind}>
        <Plus size={15} aria-hidden />
        식당 찾기·등록
      </button>
    </aside>
  );
}

export default function LunchPickPage() {
  const { spots: seedAndLocalSpots, meta, loading, error, reloadCustom } = useLunchSpots();
  const team = useLunchTeamSpots();
  const teamReady = team.status === 'ready';
  /** 팀 시드 + 팀 공용 식당(서버) + 아직 이 브라우저에만 있는 식당. 같은 이름은 시드 → 팀 → 브라우저 순으로 하나만 */
  const seedAndCustomSpots = useMemo(() => {
    const seen = new Set();
    const out = [];
    const ordered = [
      ...seedAndLocalSpots.filter((s) => s.source !== 'custom'),
      ...team.spots,
      ...seedAndLocalSpots.filter((s) => s.source === 'custom'),
    ];
    for (const s of ordered) {
      const key = normalizeSpotName(s.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [seedAndLocalSpots, team.spots]);
  const localCustomSpots = useMemo(
    () => seedAndLocalSpots.filter((s) => s.source === 'custom'),
    [seedAndLocalSpots]
  );
  const { history, markVisited, unmarkVisited, clearHistory } = useLunchHistory();
  const {
    visits: serverVisits,
    today: todayKey,
    status: visitsStatus,
    recordToday,
    clearToday,
  } = useLunchVisits();
  const {
    origin,
    stored,
    setPreset,
    setCustomOrigin,
    setRadius,
    resetOrigin,
    presets,
    customPresetId,
  } = useLunchOrigin();
  const useSeedCatalog = usesYeouidoSeedCatalog(origin);
  const [includeKakao, setIncludeKakao] = useState(() => {
    try {
      return localStorage.getItem(LUNCH_INCLUDE_KAKAO_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const toggleIncludeKakao = () =>
    setIncludeKakao((v) => {
      try {
        localStorage.setItem(LUNCH_INCLUDE_KAKAO_KEY, v ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !v;
    });
  const {
    nearby: nearbySpots,
    loading: nearbyLoading,
    error: nearbyError,
    available: nearbyKakaoAvailable,
  } = useLunchNearbySpots(origin, useSeedCatalog, includeKakao);
  const { addSpot, removeSpot } = useLunchCustomSpots();

  const seedSpots = useMemo(
    () => seedAndCustomSpots.filter((s) => s.source !== 'custom' && s.source !== 'team'),
    [seedAndCustomSpots]
  );
  const customSpotsList = useMemo(
    () => seedAndCustomSpots.filter((s) => s.source === 'custom' || s.source === 'team'),
    [seedAndCustomSpots]
  );

  /** 오늘 추천·필터용 */
  const spots = useMemo(() => {
    if (useSeedCatalog) return includeKakao ? mergeKakaoIntoCatalog(seedAndCustomSpots, nearbySpots) : seedAndCustomSpots;
    const seen = new Set();
    const merged = [];
    for (const s of [...nearbySpots, ...customSpotsList]) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
    return merged;
  }, [useSeedCatalog, includeKakao, seedAndCustomSpots, nearbySpots, customSpotsList]);

  /** 식당 탭: 팀 시드는 기준 위치와 무관하게 항상 표시 + 주변(카카오) + 내 등록 */
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

  // 여의도에서 카카오 식당을 합칠 때도 다 불러온 뒤 뽑는다(뽑힌 식당이 바로 바뀌지 않게).
  const spotsLoading = loading || ((!useSeedCatalog || includeKakao) && nearbyLoading);

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
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [visitBusy, setVisitBusy] = useState(false);

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

  const serverReady = visitsStatus === 'ready';

  /** 서버 기록 + 브라우저 기록을 합친 식당별 마지막 방문 (추천 제외용) */
  const mergedHistory = useMemo(
    () => mergeVisitHistory(serverReady ? serverVisits : [], history),
    [serverReady, serverVisits, history]
  );

  const historyExclude = useMemo(
    () => buildHistoryExcludeIds(Object.keys(mergedHistory), mergedHistory, filters.historySkipDays),
    [mergedHistory, filters.historySkipDays]
  );

  /** 화면에 보여줄 방문 기록: 서버 우선, 못 쓰면 브라우저 기록으로 근사 */
  const displayVisits = useMemo(() => {
    if (serverReady) return serverVisits;
    if (visitsStatus === 'loading') return [];
    const byId = new Map(catalogSpots.map((s) => [s.id, s]));
    return visitsFromLegacyHistory(history, (id) => byId.get(id));
  }, [serverReady, visitsStatus, serverVisits, history, catalogSpots]);

  const todayVisit = useMemo(
    () => displayVisits.find((v) => v.day === todayKey) || null,
    [displayVisits, todayKey]
  );
  const weekView = useMemo(() => buildWeekView(todayKey, displayVisits), [todayKey, displayVisits]);
  const topSpots = useMemo(() => topVisitedSpots(displayVisits, 3), [displayVisits]);
  /** 단골 = 최근 30일 3회 이상 간 곳(내 기록 기준) */
  const regulars = useMemo(() => findRegularSpots(displayVisits, todayKey), [displayVisits, todayKey]);
  const isRegular = useCallback((spot) => isRegularSpot(spot, regulars), [regulars]);

  /** 팀 전체 단골(구성원별) — 내 기록이 바뀌면 다시 불러온다 */
  const myMemberCode = team.actor && team.actor !== 'admin' ? team.actor : null;
  const teamVisits = useLunchTeamVisits(serverVisits.map((v) => `${v.day}:${v.spotId}`).join('|'));
  const teamRegulars = useMemo(() => regularsByMember(teamVisits, todayKey), [teamVisits, todayKey]);
  /** 카드에 붙일 단골 문구: 내 단골이면 '단골', 다른 구성원 것도 있으면 이름을 덧붙인다 */
  const regularLabel = useCallback(
    (spot) => {
      if (!spot) return null;
      const mine = isRegular(spot);
      const others = regularOwners(spot, teamRegulars)
        .filter((code) => code !== myMemberCode)
        .map(memberShortName);
      if (mine) return others.length ? `단골 · ${others.join('·')}` : '단골';
      return others.length ? `${others.join('·')} 단골` : null;
    },
    [isRegular, teamRegulars, myMemberCode]
  );
  /** 식당 탭 단골 칸: 나를 먼저, 그다음 다른 구성원 */
  const regularRows = useMemo(() => {
    const rows = [{ code: myMemberCode, label: '나', regulars }];
    for (const m of teamRegulars) {
      if (m.memberCode === myMemberCode) continue;
      rows.push({ code: m.memberCode, label: memberShortName(m.memberCode), regulars: m.regulars });
    }
    return rows;
  }, [myMemberCode, regulars, teamRegulars]);

  const spotsForPick = useMemo(
    () => spots.map((s) => enrichSpotWithPriceInfo(s)),
    [spots]
  );

  const runPick = useCallback(() => {
    const excludeIds = new Set([...sessionExclude, ...historyExclude]);
    const result = recommendLunch(spotsForPick, { ...filters, excludeIds }, sessionExclude);
    setPick(result);
  }, [spotsForPick, filters, sessionExclude, historyExclude]);

  const runPickRef = useRef(runPick);
  runPickRef.current = runPick;

  // 자동 다시 뽑기: 목록·조건·제외가 바뀔 때, 서버 기록을 처음 받았을 때.
  // "여기 갈래요"로 방문 기록만 바뀔 때는 다시 뽑지 않는다(고른 식당이 사라지지 않게).
  useEffect(() => {
    if (!spotsLoading && spotsForPick.length) runPickRef.current();
  }, [spotsLoading, spotsForPick, filters, sessionExclude, visitsStatus]);

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
  };

  /** "여기 갈래요" — 서버에 오늘 점심으로 기록하고 브라우저에도 표시. 추천은 다시 뽑지 않는다. */
  const handleVisit = async (spot) => {
    markVisited(spot.id);
    if (!serverReady) {
      setRegisterToast(`「${spot.name}」을(를) 이 브라우저에 기록했어요. (서버 기록 사용 불가)`);
      return;
    }
    setVisitBusy(true);
    const r = await recordToday(spot);
    setVisitBusy(false);
    if (!r.ok) setRegisterToast(`서버에 기록하지 못했어요: ${r.message}`);
  };

  /** 오늘 이미 고른 식당이 있으면 그걸 크게 보여준다 */
  const todaySpot = useMemo(() => {
    if (!todayVisit) return null;
    const found = catalogSpots.find((s) => s.id === todayVisit.spotId) || spots.find((s) => s.id === todayVisit.spotId);
    return found || { id: todayVisit.spotId, name: todayVisit.spotName, category: todayVisit.category || '' };
  }, [todayVisit, catalogSpots, spots]);
  const heroSpot = todaySpot || pick.primary;
  const altSpots = useMemo(
    () =>
      [pick.primary, ...pick.alternatives]
        .filter((s) => s && s.id !== heroSpot?.id)
        .slice(0, 3),
    [pick, heroSpot]
  );

  const handleUndoToday = async () => {
    if (todayVisit) unmarkVisited(todayVisit.spotId);
    if (!serverReady) return;
    setVisitBusy(true);
    const r = await clearToday();
    setVisitBusy(false);
    if (!r.ok) setRegisterToast(`기록을 취소하지 못했어요: ${r.message}`);
  };

  /** 이번 주 칸에서 고른 날 점심 기록. 성공하면 true */
  const handleRecordDay = async (day, spot) => {
    if (day.isToday) {
      markVisited(spot.id);
    }
    setVisitBusy(true);
    const r = await recordToday(spot, day.isToday ? undefined : day.key);
    setVisitBusy(false);
    if (!r.ok) {
      setRegisterToast(`서버에 기록하지 못했어요: ${r.message}`);
      return false;
    }
    return true;
  };

  const handleClearDay = async (day) => {
    if (day.isToday && todayVisit) unmarkVisited(todayVisit.spotId);
    setVisitBusy(true);
    const r = await clearToday(day.isToday ? undefined : day.key);
    setVisitBusy(false);
    if (!r.ok) {
      setRegisterToast(`기록을 지우지 못했어요: ${r.message}`);
      return false;
    }
    return true;
  };

  const togglePriceWithin = () =>
    setFilters((f) => ({ ...f, priceLevel: f.priceLevel === LUNCH_PRICE_WITHIN ? 0 : LUNCH_PRICE_WITHIN }));

  const activeExtraFilters =
    (filters.maxWalkMinutes > 0 ? 1 : 0) +
    (filters.historySkipDays !== DEFAULT_LUNCH_FILTERS.historySkipDays ? 1 : 0) +
    (filters.priceLevel === LUNCH_PRICE_OVER ? 1 : 0);

  /** 서버(팀 목록)를 쓸 수 있으면 팀 목록에, 아니면 이 브라우저에 등록. 실패하면 { error } */
  const handleAddSpot = useCallback(
    async (input) => {
      if (teamReady) {
        const r = await team.addSpot(input);
        return r.ok ? r.spot : { error: r.message };
      }
      const spot = addSpot(input);
      if (spot) reloadCustom();
      return spot;
    },
    [teamReady, team, addSpot, reloadCustom]
  );

  const handleRemoveCustom = useCallback(
    async (spot) => {
      const where = spot.source === 'team' ? '팀 식당 목록' : '이 브라우저 목록';
      if (!window.confirm(`「${spot.name}」을(를) ${where}에서 삭제할까요?`)) return;
      if (spot.source === 'team') {
        const r = await team.removeSpot(spot.id);
        if (!r.ok) setRegisterToast(`삭제하지 못했어요: ${r.message}`);
        return;
      }
      removeSpot(spot.id);
      reloadCustom();
    },
    [team, removeSpot, reloadCustom]
  );

  /** 고칠 수 있는 식당: 이 브라우저 등록, 또는 팀 목록 중 내가 등록했거나 관리자 */
  const canManageSpot = useCallback((spot) => spot?.source === 'custom' || team.canManage(spot), [team]);

  /** 이 브라우저에만 있던 식당을 팀 목록으로 올린다(이미 있으면 브라우저 것만 정리) */
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const handleUploadLocal = useCallback(async () => {
    setUploadingLocal(true);
    let added = 0;
    let existed = 0;
    let failed = 0;
    for (const spot of localCustomSpots) {
      const r = await team.addSpot(spot);
      if (r.ok) added += 1;
      else if (r.duplicateId) existed += 1;
      else {
        failed += 1;
        continue;
      }
      removeSpot(spot.id);
    }
    reloadCustom();
    setUploadingLocal(false);
    setRegisterToast(
      `팀 목록으로 ${added}곳 올렸어요.${existed ? ` ${existed}곳은 이미 있어 이 브라우저 것만 정리했어요.` : ''}${
        failed ? ` ${failed}곳은 올리지 못했어요.` : ''
      }`
    );
  }, [localCustomSpots, team, removeSpot, reloadCustom]);

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
    async (input) => {
      if (!editingSpot) return null;
      let saved;
      if (editingSpot.source === 'team') {
        const r = await team.updateSpot(editingSpot.id, input);
        if (!r.ok) return { error: r.message };
        saved = r.spot;
      } else {
        saved = addSpot({ ...input, id: editingSpot.id, addedAt: editingSpot.addedAt });
        if (saved) reloadCustom();
      }
      if (saved) {
        setEditingSpot(null);
        setRegisterToast(`「${saved.name}」 정보를 수정했습니다.`);
      }
      return saved;
    },
    [editingSpot, team, addSpot, reloadCustom]
  );

  const handleStartEdit = useCallback((spot) => {
    setEditingSpot(spot);
  }, []);

  const handleAddFromSearch = useCallback(
    async (spot) => {
      const added = await handleAddSpot({
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
      if (added?.error) setRegisterToast(added.error);
      else if (added) setRegisterToast(`「${added.name}」을(를) 식당 목록에 추가했습니다.`);
    },
    [handleAddSpot]
  );

  useEffect(() => {
    let alive = true;
    probeKakaoLocal().then((ok) => {
      if (alive) setKakaoAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const runSearch = async () => {
    if (!kakaoAvailable) return;
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
      <header className="lunch-top-bar">
        <div className="lunch-top-bar__brand">
          <span className="lunch-top-bar__icon" aria-hidden="true">
            <UtensilsCrossed size={20} />
          </span>
          <div className="lunch-top-bar__title">
            <h1>오늘 뭐 먹지</h1>
            <p className="lunch-top-bar__tagline">
              <MapPin size={13} aria-hidden />
              {origin.label} · 반경 {formatRadiusKm(origin.radiusM)} · 식당 {catalogCount}곳
              {teamReady
                ? team.spots.length > 0 && ` (팀 등록 ${team.spots.length})`
                : customCount > 0 && ` (내 등록 ${customCount})`}
              <button
                type="button"
                className="lunch-link"
                onClick={() => setShowOriginSettings((v) => !v)}
                aria-expanded={showOriginSettings}
              >
                <Settings2 size={12} aria-hidden />
                {showOriginSettings ? '닫기' : '위치 변경'}
              </button>
            </p>
          </div>
        </div>
        <nav className="lunch-seg" aria-label="점심 메뉴">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`lunch-seg__btn${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </nav>
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
            setRadius={setRadius}
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

      {useSeedCatalog && !spotsLoading && seedSpots.length === 0 && !error && (
        <p className="lunch-pick-banner" role="alert">
          팀 맛집 시드(JSON)를 불러오지 못했습니다. 새로고침하거나 배포 경로를 확인해 주세요.
        </p>
      )}

      {!useSeedCatalog && tab === 'today' && !spotsLoading && (
        <p className="lunch-pick-banner lunch-pick-banner--info" role="status">
          {nearbyKakaoAvailable ? (
            <>
              <strong>{origin.label}</strong> 주변 {nearbySpots.length}곳에서 추천해요. 식당 탭에는 팀 시드{' '}
              {seedSpots.length}곳이 그대로 있습니다.
            </>
          ) : (
            <>
              카카오 API가 필요합니다. <strong>{origin.label}</strong> 주변 추천은 찾기·등록으로 채우고, 식당
              탭에서 팀 시드 {seedSpots.length}곳을 확인하세요.
            </>
          )}
          {nearbyError && ` (${nearbyError})`}
        </p>
      )}

      {spotsLoading && <p className="lunch-pick-status">맛집 목록 불러오는 중…</p>}
      {error && (
        <p className="lunch-pick-status lunch-pick-status--error" role="alert">
          {error}
        </p>
      )}

      {!spotsLoading && !error && tab === 'today' && (
        <div className="lunch-c">
          <div className="lunch-c__main">
            <section className="lunch-chips" aria-label="오늘 조건">
              <button
                type="button"
                className={`lunch-chip${filters.priceLevel === LUNCH_PRICE_WITHIN ? ' is-on is-strong' : ''}`}
                onClick={togglePriceWithin}
                aria-pressed={filters.priceLevel === LUNCH_PRICE_WITHIN}
              >
                {LUNCH_ALLOWANCE_WON.toLocaleString('ko-KR')}원 이내
              </button>
              {Object.entries(LUNCH_TAGS).map(([key, { label, emoji }]) => (
                <button
                  key={key}
                  type="button"
                  className={`lunch-chip${filters.tags.includes(key) ? ' is-on' : ''}`}
                  onClick={() => toggleTag(key)}
                  aria-pressed={filters.tags.includes(key)}
                >
                  <span aria-hidden>{emoji}</span> {label}
                </button>
              ))}
              <button
                type="button"
                className={`lunch-chip lunch-chip--more${showMoreFilters ? ' is-open' : ''}`}
                onClick={() => setShowMoreFilters((v) => !v)}
                aria-expanded={showMoreFilters}
              >
                조건 더보기{activeExtraFilters > 0 ? ` ${activeExtraFilters}` : ''}
                <ChevronDown size={13} aria-hidden />
              </button>
            </section>

            {showMoreFilters && (
              <section className="lunch-more" aria-label="상세 조건">
                <label>
                  식대
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
                    onChange={(e) => setFilters((f) => ({ ...f, maxWalkMinutes: Number(e.target.value) }))}
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
                    onChange={(e) => setFilters((f) => ({ ...f, historySkipDays: Number(e.target.value) }))}
                    className="form-input"
                  >
                    {HISTORY_SKIP_DAYS_OPTIONS.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </label>
                {useSeedCatalog && nearbyKakaoAvailable && (
                  <label className="lunch-more__check">
                    <input type="checkbox" checked={includeKakao} onChange={toggleIncludeKakao} />
                    카카오 근처 식당도 추천에 넣기
                    {includeKakao && nearbySpots.length > 0 && <small>(카카오 {nearbySpots.length}곳 · 팀 목록 우선)</small>}
                  </label>
                )}
                <div className="lunch-more__actions">
                  <span>
                    후보 {pick.poolSize}곳 · 오늘 제외 {sessionExclude.size}곳
                  </span>
                  <button type="button" className="lunch-link" onClick={() => persistSessionExclude(new Set())}>
                    제외 초기화
                  </button>
                  <button
                    type="button"
                    className="lunch-link"
                    onClick={() => {
                      if (window.confirm('이 브라우저의 방문 표시를 지울까요? (서버 기록은 그대로예요)')) clearHistory();
                    }}
                  >
                    브라우저 방문 표시 지우기
                  </button>
                </div>
              </section>
            )}

            {heroSpot ? (
              <>
                <PickHero
                  spot={heroSpot}
                  todayVisit={todayVisit}
                  busy={visitBusy}
                  regular={regularLabel(heroSpot)}
                  onChoose={handleVisit}
                  onReroll={runPick}
                  onExclude={handleExclude}
                  onUndo={handleUndoToday}
                  onEdit={canManageSpot(heroSpot) ? handleStartEdit : undefined}
                />
                {altSpots.length > 0 && (
                  <>
                    <h2 className="lunch-c__heading">{todayVisit ? '다른 후보' : '이것도 괜찮아요'}</h2>
                    <div className="lunch-mini-grid">
                      {altSpots.map((s) => (
                        <AltMini
                          key={s.id}
                          spot={s}
                          busy={visitBusy}
                          regular={regularLabel(s)}
                          onChoose={handleVisit}
                          onExclude={handleExclude}
                        />
                      ))}
                    </div>
                  </>
                )}
                <p className="lunch-c__footnote">
                  추천 식당은 실제 식당명과 찾는 데 도움이 되는 키워드가 섞여 있어요.
                </p>
              </>
            ) : (
              <div className="lunch-empty" role="status">
                <span className="lunch-empty__emoji" aria-hidden>
                  🥲
                </span>
                <p className="lunch-empty__title">조건에 맞는 맛집이 없어요</p>
                <p className="lunch-empty__hint">
                  {!useSeedCatalog && !nearbyKakaoAvailable
                    ? '찾기·등록에서 맛집을 식당 목록에 추가해 보세요.'
                    : '조건을 줄이거나 「조건 더보기」에서 제외를 초기화해 보세요.'}
                  {seedSpots.length > 0 && !useSeedCatalog && (
                    <>
                      {' '}
                      여의도라면 위치 변경에서 <strong>오케스트로 (파크원타워2)</strong>를 고르세요.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <LunchSidePanel
            week={weekView}
            top={topSpots}
            regulars={regulars}
            serverReady={serverReady || visitsStatus === 'loading'}
            canEdit={serverReady}
            catalog={catalogSpots}
            busy={visitBusy}
            onRecordDay={handleRecordDay}
            onClearDay={handleClearDay}
            onFind={() => setTab('find')}
          />
        </div>
      )}

      {!spotsLoading && !error && tab === 'catalog' && (
        <div className="lunch-pick-panel lunch-pick-panel--narrow">
          <div className="lunch-panel-head">
            <p className="lunch-catalog-intro">
              {useSeedCatalog ? `팀 시드 ${seedCount}곳` : `${origin.label} 주변 ${nearbySpots.length}곳`}
              {teamReady
                ? team.spots.length > 0 && ` + 팀 등록 ${team.spots.length}곳`
                : customCount > 0 && ` + 내가 등록 ${customCount}곳`}
            </p>
            <input
              type="search"
              className="form-input lunch-catalog-search"
              placeholder="이름·메뉴·종류 검색"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
            />
          </div>
          {teamReady && localCustomSpots.length > 0 && (
            <p className="lunch-pick-banner lunch-pick-banner--info" role="status">
              이 브라우저에만 있는 식당이 {localCustomSpots.length}곳 있어요. 팀 목록으로 올리면 다른 구성원에게도 보여요.{' '}
              <button type="button" className="lunch-link lunch-link--strong" onClick={handleUploadLocal} disabled={uploadingLocal}>
                {uploadingLocal ? '올리는 중…' : '팀 목록으로 올리기'}
              </button>
            </p>
          )}
          <section className="lunch-regulars" aria-label="단골">
            <h3 className="lunch-regulars__title">
              ★ 단골 <small>{REGULAR_RULE} 간 곳 · 구성원별</small>
            </h3>
            {regularRows.map((row) => (
              <div key={row.code || 'me'} className="lunch-regulars__row">
                <span className="lunch-regulars__who">{row.label}</span>
                {row.regulars.length ? (
                  <ul className="lunch-regulars__list">
                    {row.regulars.map((g) => (
                      <li key={g.name}>
                        <strong>{g.spotName}</strong>
                        <span>{g.count}회</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="lunch-regulars__none">
                    {row.label === '나'
                      ? `아직 없어요. 같은 곳을 ${REGULAR_DAYS}일 안에 ${REGULAR_MIN_VISITS}번 가면 단골이 돼요.`
                      : '아직 없어요.'}
                  </span>
                )}
              </div>
            ))}
          </section>
          <div className="lunch-catalog-grid">
            {catalogFiltered.map((s) => (
              <SpotCard
                key={s.id}
                spot={s}
                variant="alt"
                regular={regularLabel(s)}
                onVisit={handleVisit}
                onEdit={canManageSpot(s) ? handleStartEdit : undefined}
                onRemove={canManageSpot(s) ? handleRemoveCustom : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {!spotsLoading && tab === 'find' && (
        <div className="lunch-find">
          <section className="lunch-pick-panel">
            <h2 className="lunch-register-title">주변 식당 찾기</h2>
            <p className="lunch-search-hint">
              {origin.label} 기준 반경 {formatRadiusKm(origin.radiusM)}
            </p>
            {!kakaoAvailable && (
              <p className="lunch-pick-banner" role="status">
                지금은 카카오 장소 검색을 쓸 수 없어요. 아래 「직접 등록」으로 식당을 추가해 주세요.
              </p>
            )}
            <div className="lunch-search-bar">
              <input
                type="search"
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder="파크원타워 맛집, 국밥"
                disabled={!kakaoAvailable}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={runSearch}
                disabled={searchLoading || !kakaoAvailable}
              >
                검색
              </button>
            </div>
            {searchLoading && <p className="lunch-pick-status">검색 중…</p>}
            {searchError && <p className="lunch-pick-status lunch-pick-status--error">{searchError}</p>}
            <div className="lunch-catalog-grid">
              {searchResults.map((s) => (
                <SpotCard key={s.id} spot={s} variant="alt" onAddToCatalog={handleAddFromSearch} />
              ))}
            </div>
          </section>

          <section className="lunch-pick-panel">
            <h2 className="lunch-register-title">직접 등록</h2>
            <p className="lunch-register-lead">
              {teamReady
                ? '등록한 식당은 팀 식당 목록에 올라가 모든 구성원에게 보여요. 수정·삭제는 등록한 사람과 관리자만 할 수 있어요.'
                : '팀 식당 목록을 불러오지 못해, 등록한 식당은 이 브라우저에만 저장돼요.'}
            </p>
            <LunchAddSpotForm
              onAdd={handleAddSpot}
              submitLabel="식당 등록"
              kakaoAvailable={kakaoAvailable}
              searchCenter={{
                lat: origin.center.lat,
                lng: origin.center.lng,
                radiusM: origin.radiusM,
              }}
            />
          </section>
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
            aria-label="식당 수정"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="lunch-edit-drawer__header">
              <div className="lunch-edit-drawer__title">식당 수정</div>
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
                kakaoAvailable={kakaoAvailable}
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
