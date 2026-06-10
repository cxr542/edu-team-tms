import {
  JOURNAL_CATS,
  JOURNAL_CAT_ORDER,
  WEEK_COLUMN_TEMPLATE,
} from '../constants/journalCategories.js';

/** @typedef {{ label?: string, color?: string }} JournalCategoryOverride */
/** @typedef {{ categoryOrder?: string[], categories?: Record<string, JournalCategoryOverride>, weekColumnTemplate?: string }} JournalMemberPrefs */

export function buildWeekColumnTemplateFromCategories(cats, order) {
  const lines = [];
  order.forEach((key) => {
    const cat = cats[key];
    if (!cat?.label) return;
    lines.push(`• ${cat.label}`, '└ ');
  });
  return lines.join('\n') || WEEK_COLUMN_TEMPLATE;
}

export function defaultMemberPrefs() {
  return {
    categoryOrder: [...JOURNAL_CAT_ORDER],
    categories: Object.fromEntries(
      JOURNAL_CAT_ORDER.map((key) => [
        key,
        { label: JOURNAL_CATS[key].label, color: JOURNAL_CATS[key].color },
      ])
    ),
    weekColumnTemplate: WEEK_COLUMN_TEMPLATE,
  };
}

export function normalizeMemberPrefs(raw) {
  const base = defaultMemberPrefs();
  if (!raw || typeof raw !== 'object') return base;

  const categoryOrder = Array.isArray(raw.categoryOrder)
    ? raw.categoryOrder.filter((k) => typeof k === 'string' && JOURNAL_CATS[k])
    : base.categoryOrder;

  const categories = { ...base.categories };
  if (raw.categories && typeof raw.categories === 'object') {
    Object.keys(raw.categories).forEach((key) => {
      if (!JOURNAL_CATS[key]) return;
      const over = raw.categories[key];
      if (!over || typeof over !== 'object') return;
      categories[key] = {
        label: typeof over.label === 'string' ? over.label : categories[key].label,
        color: typeof over.color === 'string' ? over.color : categories[key].color,
      };
    });
  }

  JOURNAL_CAT_ORDER.forEach((key) => {
    if (!categoryOrder.includes(key)) categoryOrder.push(key);
  });

  const weekColumnTemplate =
    typeof raw.weekColumnTemplate === 'string' && raw.weekColumnTemplate.trim()
      ? raw.weekColumnTemplate
      : base.weekColumnTemplate;

  return { categoryOrder, categories, weekColumnTemplate };
}

export function resolveMemberCategories(prefs) {
  const p = normalizeMemberPrefs(prefs);
  const cats = {};
  p.categoryOrder.forEach((key) => {
    const def = JOURNAL_CATS[key];
    if (!def) return;
    const over = p.categories[key] || {};
    cats[key] = {
      label: over.label?.trim() || def.label,
      color: over.color?.trim() || def.color,
    };
  });
  JOURNAL_CAT_ORDER.forEach((key) => {
    if (!cats[key]) {
      const def = JOURNAL_CATS[key];
      const over = p.categories[key] || {};
      cats[key] = {
        label: over.label?.trim() || def.label,
        color: over.color?.trim() || def.color,
      };
    }
  });
  return {
    cats,
    order: p.categoryOrder.length ? p.categoryOrder : [...JOURNAL_CAT_ORDER],
  };
}

export function resolveMemberWeekColumnTemplate(prefs) {
  return normalizeMemberPrefs(prefs).weekColumnTemplate;
}
