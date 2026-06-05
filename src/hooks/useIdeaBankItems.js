import { useCallback, useMemo, useState } from 'react';

const IDEA_BANK_STORAGE_KEY = 'tms-idea-bank-v1';

function readItems() {
  try {
    const raw = localStorage.getItem(IDEA_BANK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.name === 'string')
      .map((item) => ({
        id: item.id || `idea-${Date.now()}`,
        name: item.name.trim(),
        description: typeof item.description === 'string' ? item.description.trim() : '',
        createdAt: item.createdAt || new Date().toISOString(),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

function writeItems(items) {
  localStorage.setItem(IDEA_BANK_STORAGE_KEY, JSON.stringify(items));
}

export function useIdeaBankItems() {
  const [items, setItems] = useState(readItems);

  const addItem = useCallback((draft) => {
    const name = String(draft?.name || '').trim();
    const description = String(draft?.description || '').trim();
    if (!name) return { ok: false, reason: 'name-required' };

    const duplicated = items.some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (duplicated) return { ok: false, reason: 'duplicate-name' };

    const next = [
      {
        id: `idea-${Date.now()}`,
        name,
        description,
        createdAt: new Date().toISOString(),
      },
      ...items,
    ];
    setItems(next);
    writeItems(next);
    return { ok: true };
  }, [items]);

  const removeItem = useCallback((id) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    writeItems(next);
  }, [items]);

  const count = useMemo(() => items.length, [items]);

  return { items, count, addItem, removeItem };
}
