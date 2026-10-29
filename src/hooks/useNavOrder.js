import { useCallback, useEffect, useState } from 'react';
import {
  NAV_GROUP_DEFAULT_ORDER,
  NAV_ORDER_STORAGE_KEY,
  applyNavOrder,
  moveNavItem,
  sanitizeNavOrder,
} from '../utils/navOrder';

function loadNavOrder() {
  try {
    const raw = localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    return raw ? sanitizeNavOrder(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** 사이드바 그룹별 메뉴 순서. 이 브라우저에만 저장되고, 저장이 없으면 기본 순서다. */
export function useNavOrder() {
  const [saved, setSaved] = useState(loadNavOrder);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* 저장소를 못 써도 현재 화면의 순서는 유지 */
    }
  }, [saved]);

  const orderOf = useCallback(
    (group) => applyNavOrder(NAV_GROUP_DEFAULT_ORDER[group] || [], saved[group]),
    [saved]
  );

  const moveItem = useCallback((group, id, delta) => {
    setSaved((prev) => {
      const current = applyNavOrder(NAV_GROUP_DEFAULT_ORDER[group] || [], prev[group]);
      return { ...prev, [group]: moveNavItem(current, id, delta) };
    });
  }, []);

  const resetOrder = useCallback(() => setSaved({}), []);

  return { orderOf, moveItem, resetOrder };
}
