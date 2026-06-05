export const LUNCH_DATA_URL = `${import.meta.env.BASE_URL || '/'}data/yeouido-lunch.json`;

export const LUNCH_HISTORY_KEY = 'tms-lunch-history-v1';

export const LUNCH_SESSION_EXCLUDE_KEY = 'tms-lunch-session-exclude-v1';

export const LUNCH_CUSTOM_SPOTS_KEY = 'tms-lunch-custom-spots-v1';

/** 회사 점심 식대 (원) */
export const LUNCH_ALLOWANCE_WON = 13000;

/** priceLevel: 0 = 미확인, 1 = 식대 이내, 2 = 식대 초과 (필터 value 0은 「전체」와 별개) */
export const LUNCH_PRICE_UNKNOWN = 0;
export const LUNCH_PRICE_WITHIN = 1;
export const LUNCH_PRICE_OVER = 2;

export const PRICE_LEVELS = [
  { value: 0, label: '전체 (식대 이내 우선)' },
  { value: LUNCH_PRICE_WITHIN, label: `13,000원 이내 (식대)` },
  { value: LUNCH_PRICE_OVER, label: '13,000원 초과' },
];

export const WALK_MAX_OPTIONS = [
  { value: 0, label: '도보 제한 없음' },
  { value: 5, label: '5분 이내' },
  { value: 8, label: '8분 이내' },
  { value: 12, label: '12분 이내' },
];

export const HISTORY_SKIP_DAYS_OPTIONS = [
  { value: 0, label: '최근 방문 제외 안 함' },
  { value: 3, label: '3일 이내 제외' },
  { value: 7, label: '7일 이내 제외' },
  { value: 14, label: '14일 이내 제외' },
];

export const LUNCH_TAGS = {
  fast: { label: '빠른 식사', emoji: '⚡' },
  group: { label: '단체', emoji: '👥' },
  solo: { label: '혼밥', emoji: '🙋' },
  rain: { label: '실내/비', emoji: '☔' },
  noodle: { label: '면/국물', emoji: '🍜' },
  cuisineKorean: { label: '한식', emoji: '🍚' },
  cuisineChinese: { label: '중식', emoji: '🥟' },
  cuisineWestern: { label: '양식', emoji: '🥗' },
};

export const DEFAULT_LUNCH_FILTERS = {
  priceLevel: LUNCH_PRICE_WITHIN,
  maxWalkMinutes: 0,
  tags: [],
  historySkipDays: 7,
};

export const KAKAO_SEARCH_CACHE_KEY = 'tms-lunch-kakao-cache-v1';
export const KAKAO_CACHE_TTL_MS = 10 * 60 * 1000;
