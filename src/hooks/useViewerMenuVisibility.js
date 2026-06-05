import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_VIEWER_MENU_VISIBILITY,
  VIEWER_MENU_MODULE_IDS,
  VIEWER_MENU_STORAGE_KEY,
  normalizeViewerMenuVisibility,
} from '../constants/viewerMenu';

function readStored() {
  try {
    const raw = localStorage.getItem(VIEWER_MENU_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VIEWER_MENU_VISIBILITY };
    return normalizeViewerMenuVisibility(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_VIEWER_MENU_VISIBILITY };
  }
}

export function useViewerMenuVisibility() {
  const [visibility, setVisibility] = useState(readStored);

  const persist = useCallback((next) => {
    const normalized = normalizeViewerMenuVisibility(next);
    localStorage.setItem(VIEWER_MENU_STORAGE_KEY, JSON.stringify(normalized));
    setVisibility(normalized);
    return normalized;
  }, []);

  const setModuleVisible = useCallback(
    (moduleId, visible) => {
      if (moduleId === 'ledger') return visibility;
      persist({ ...visibility, [moduleId]: visible });
    },
    [visibility, persist]
  );

  const applyVisibility = useCallback((draft) => persist(draft), [persist]);

  const resetVisibility = useCallback(() => persist({ ...DEFAULT_VIEWER_MENU_VISIBILITY }), [persist]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === VIEWER_MENU_STORAGE_KEY) setVisibility(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const visibleModuleIds = VIEWER_MENU_MODULE_IDS.filter((id) => visibility[id]);

  return {
    visibility,
    visibleModuleIds,
    setModuleVisible,
    applyVisibility,
    resetVisibility,
    viewerNavCount: visibleModuleIds.length,
  };
}
