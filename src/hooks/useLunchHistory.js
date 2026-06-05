import { useCallback, useEffect, useState } from 'react';
import { LUNCH_HISTORY_KEY } from '../constants/lunchPick';

/** @returns {Record<string, string>} id -> ISO visitedAt */
function readHistory() {
  try {
    const raw = localStorage.getItem(LUNCH_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function useLunchHistory() {
  const [history, setHistory] = useState(readHistory);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === LUNCH_HISTORY_KEY) setHistory(readHistory());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const markVisited = useCallback((spotId) => {
    if (!spotId) return;
    setHistory((prev) => {
      const next = { ...prev, [spotId]: new Date().toISOString() };
      localStorage.setItem(LUNCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(LUNCH_HISTORY_KEY);
    setHistory({});
  }, []);

  return { history, markVisited, clearHistory };
}
