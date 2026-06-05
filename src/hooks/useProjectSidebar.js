import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tms-sidebar-collapsed';
const DRAWER_BP = 1024;

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useProjectSidebar() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDrawerMode, setIsDrawerMode] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${DRAWER_BP}px)`).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${DRAWER_BP}px)`);
    const onChange = () => {
      setIsDrawerMode(mq.matches);
      if (!mq.matches) setDrawerOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('project-sidebar-collapsed-boot', collapsed);
  }, [collapsed]);

  useEffect(() => {
    document.body.classList.toggle('project-nav-open', drawerOpen);
    return () => document.body.classList.remove('project-nav-open');
  }, [drawerOpen]);

  const toggleSidebar = useCallback(() => {
    if (isDrawerMode) {
      setDrawerOpen((open) => !open);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [isDrawerMode]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const onNavSelect = useCallback(() => {
    if (isDrawerMode) setDrawerOpen(false);
  }, [isDrawerMode]);

  return {
    collapsed,
    drawerOpen,
    isDrawerMode,
    toggleSidebar,
    closeDrawer,
    onNavSelect,
  };
}

export { STORAGE_KEY as TMS_SIDEBAR_STORAGE_KEY };
