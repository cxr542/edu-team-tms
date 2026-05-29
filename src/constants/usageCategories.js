/** 교육팀 TMS 사용 유형 기준표 (기본값) */
export const DEFAULT_USAGE_CATEGORIES = [
  {
    id: 'lunch-extra',
    label: '점심식사 추가분',
    color: '#3b82f6',
    description: '점심 식사 추가 정산',
    matchKeywords: ['점심식사 추가분'],
  },
  {
    id: 'snack',
    label: '간식',
    color: '#f59e0b',
    description: '간식·다과류 지출',
    matchKeywords: ['간식'],
  },
  {
    id: 'teatime',
    label: '티타임',
    color: '#ec4899',
    description: '티타임·다과 모임',
    matchKeywords: ['티타임'],
  },
  {
    id: 'other',
    label: '기타',
    color: '#94a3b8',
    description: '위 항목에 해당하지 않는 지출',
    matchKeywords: [],
  },
];

export const USAGE_CATEGORIES_STORAGE_KEY = 'tms-usage-categories-v1';

export const DEFAULT_ATTENDEES = '팀 모두';

/** @deprecated — DEFAULT_USAGE_CATEGORIES 사용 */
export const USAGE_CATEGORIES = DEFAULT_USAGE_CATEGORIES;

let activeCategories = loadUsageCategories();

export function loadUsageCategories() {
  try {
    const raw = localStorage.getItem(USAGE_CATEGORIES_STORAGE_KEY);
    if (!raw) return cloneDefaults();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneDefaults();
    return parsed.map(ensureCategoryShape);
  } catch {
    return cloneDefaults();
  }
}

export function saveUsageCategories(categories) {
  const normalized = categories.map(ensureCategoryShape);
  localStorage.setItem(USAGE_CATEGORIES_STORAGE_KEY, JSON.stringify(normalized));
  setActiveUsageCategories(normalized);
  return normalized;
}

export function resetUsageCategoriesToDefault() {
  localStorage.removeItem(USAGE_CATEGORIES_STORAGE_KEY);
  const defaults = cloneDefaults();
  setActiveUsageCategories(defaults);
  return defaults;
}

export function setActiveUsageCategories(categories) {
  activeCategories = categories?.length ? categories.map(ensureCategoryShape) : cloneDefaults();
}

export function getActiveUsageCategories() {
  return activeCategories;
}

function cloneDefaults() {
  return DEFAULT_USAGE_CATEGORIES.map((c) => ({ ...c, matchKeywords: [...c.matchKeywords] }));
}

export function createCategoryId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ensureCategoryShape(raw) {
  const label = String(raw?.label ?? '').trim();
  return {
    id: raw?.id || createCategoryId(),
    label,
    color: raw?.color || '#94a3b8',
    description: String(raw?.description ?? '').trim(),
    matchKeywords: Array.isArray(raw?.matchKeywords)
      ? raw.matchKeywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
  };
}

export function isUsageCategory(label, categories = activeCategories) {
  return categories.some((c) => c.label === label);
}

/**
 * 엑셀 비고·식사 열 + 기준표 matchKeywords 로 사용 유형 결정
 * (위에서 아래 순서, 긴 키워드 우선)
 */
export function resolveUsageCategory({ note = '', mealLabel = '' } = {}, categories = activeCategories) {
  const n = String(note).trim();
  const meal = String(mealLabel).trim();
  const haystack = `${n} ${meal}`.trim();

  const rules = categories
    .filter((c) => c.label !== '기타')
    .flatMap((c) =>
      (c.matchKeywords?.length ? c.matchKeywords : [c.label])
        .filter(Boolean)
        .map((kw) => ({ kw, label: c.label }))
    )
    .sort((a, b) => b.kw.length - a.kw.length);

  for (const { kw, label } of rules) {
    if (haystack.includes(kw)) return label;
  }

  if (meal === '간식') {
    const snack = categories.find((c) => c.label === '간식');
    if (snack) return snack.label;
  }

  const other = categories.find((c) => c.label === '기타');
  return other?.label || categories[categories.length - 1]?.label || '기타';
}

export function normalizeAttendees(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed === '미지정') return DEFAULT_ATTENDEES;
  return trimmed;
}

export function getCategoryStyle(label, categories = activeCategories) {
  return (
    categories.find((c) => c.label === label) ??
    categories.find((c) => c.label === '기타') ??
    DEFAULT_USAGE_CATEGORIES[DEFAULT_USAGE_CATEGORIES.length - 1]
  );
}

export function normalizeTransaction(tx, categories = activeCategories) {
  const note = tx.extraData?.비고 ?? '';
  const mealLabel = String(tx.description || '').split(' · ')[0]?.trim() ?? '';

  const category = isUsageCategory(tx.category, categories)
    ? tx.category
    : resolveUsageCategory({ note, mealLabel }, categories);

  const extraData =
    tx.extraData && typeof tx.extraData === 'object'
      ? Object.fromEntries(
          Object.entries(tx.extraData)
            .filter(([k]) => k && k !== 'undefined')
            .map(([k, v]) => [k, v == null ? '' : v])
        )
      : {};

  return {
    ...tx,
    category,
    attendees: normalizeAttendees(tx.attendees),
    extraData,
  };
}

export function countTransactionsByCategory(transactions, label) {
  return transactions.filter((t) => t.category === label).length;
}
