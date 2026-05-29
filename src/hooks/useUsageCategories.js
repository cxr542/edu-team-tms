import { useCallback, useEffect, useState } from 'react';
import {
  loadUsageCategories,
  saveUsageCategories,
  resetUsageCategoriesToDefault,
  setActiveUsageCategories,
  createCategoryId,
  DEFAULT_USAGE_CATEGORIES,
} from '../constants/usageCategories';

export function useUsageCategories({ readOnly = false, seedCategories = null } = {}) {
  const [categories, setCategories] = useState(() => {
    if (seedCategories?.length) return seedCategories;
    return loadUsageCategories();
  });

  useEffect(() => {
    if (seedCategories?.length) {
      setCategories(seedCategories);
    }
  }, [seedCategories]);

  useEffect(() => {
    setActiveUsageCategories(categories);
  }, [categories]);

  const persist = useCallback(
    (next) => {
      if (readOnly) return next;
      const saved = saveUsageCategories(next);
      setCategories(saved);
      return saved;
    },
    [readOnly]
  );

  const readOnlyError = { ok: false, error: '조회 전용 모드에서는 수정할 수 없습니다.' };

  const addCategory = useCallback(
    (draft) => {
      if (readOnly) return readOnlyError;
      const label = String(draft.label ?? '').trim();
      if (!label) return { ok: false, error: '유형 이름을 입력해 주세요.' };
      if (categories.some((c) => c.label === label)) {
        return { ok: false, error: '이미 같은 이름의 사용 유형이 있습니다.' };
      }
      const next = [
        ...categories,
        {
          id: createCategoryId(),
          label,
          color: draft.color || '#94a3b8',
          description: String(draft.description ?? '').trim(),
          matchKeywords: parseKeywords(draft.matchKeywords),
        },
      ];
      persist(next);
      return { ok: true };
    },
    [categories, persist, readOnly]
  );

  const updateCategory = useCallback(
    (id, draft) => {
      if (readOnly) return readOnlyError;
      const idx = categories.findIndex((c) => c.id === id);
      if (idx < 0) return { ok: false, error: '항목을 찾을 수 없습니다.' };
      const label = String(draft.label ?? '').trim();
      if (!label) return { ok: false, error: '유형 이름을 입력해 주세요.' };
      if (categories.some((c) => c.id !== id && c.label === label)) {
        return { ok: false, error: '이미 같은 이름의 사용 유형이 있습니다.' };
      }
      const next = categories.map((c) =>
        c.id === id
          ? {
              ...c,
              label,
              color: draft.color || c.color,
              description: String(draft.description ?? '').trim(),
              matchKeywords: parseKeywords(draft.matchKeywords),
            }
          : c
      );
      persist(next);
      return { ok: true };
    },
    [categories, persist, readOnly]
  );

  const removeCategory = useCallback(
    (id, transactions = []) => {
      if (readOnly) return readOnlyError;
      const target = categories.find((c) => c.id === id);
      if (!target) return { ok: false, error: '항목을 찾을 수 없습니다.' };
      if (target.label === '기타' && categories.filter((c) => c.label === '기타').length <= 1) {
        return { ok: false, error: '「기타」는 최소 1개 유지해야 합니다.' };
      }
      if (categories.length <= 1) {
        return { ok: false, error: '사용 유형은 최소 1개 이상 필요합니다.' };
      }
      const inUse = transactions.filter((t) => t.category === target.label).length;
      if (inUse > 0) {
        return {
          ok: false,
          error: `「${target.label}」을(를) 쓰는 지출이 ${inUse}건 있습니다. 먼저 다른 유형으로 바꿔 주세요.`,
        };
      }
      persist(categories.filter((c) => c.id !== id));
      return { ok: true };
    },
    [categories, persist, readOnly]
  );

  const resetToDefault = useCallback(() => {
    if (readOnly) return DEFAULT_USAGE_CATEGORIES.map((c) => ({ ...c, matchKeywords: [...c.matchKeywords] }));
    const defaults = resetUsageCategoriesToDefault();
    setCategories(defaults);
    return defaults;
  }, [readOnly]);

  return {
    categories,
    setCategories: persist,
    addCategory,
    updateCategory,
    removeCategory,
    resetToDefault,
    defaultCategories: DEFAULT_USAGE_CATEGORIES,
  };
}

function parseKeywords(value) {
  if (Array.isArray(value)) return value.map((k) => String(k).trim()).filter(Boolean);
  return String(value ?? '')
    .split(/[,，\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
}
