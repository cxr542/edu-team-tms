import { useCallback, useEffect, useState } from 'react';
import {
  NAV_GROUP_DEFAULT_ORDER,
  NAV_ORDER_STORAGE_KEY,
  applyNavOrder,
  moveNavItem,
  moveNavItemToEdge,
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

/** 사이드바 그룹별 메뉴 순서. 이 브라우저에 보관(캐시)하고, 팀 공유 설정은 useSharedNavSettings 가 맞춘다. 저장이 없으면 기본 순서다. */
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

  const moveItemToEdge = useCallback((group, id, edge) => {
    setSaved((prev) => {
      const current = applyNavOrder(NAV_GROUP_DEFAULT_ORDER[group] || [], prev[group]);
      return { ...prev, [group]: moveNavItemToEdge(current, id, edge) };
    });
  }, []);

  const resetOrder = useCallback(() => setSaved({}), []);
  /** 팀 공유 저장소에서 읽은 순서로 통째로 바꾼다 */
  const replaceOrder = useCallback((next) => setSaved(sanitizeNavOrder(next)), []);

  return { orderOf, moveItem, moveItemToEdge, resetOrder, replaceOrder, saved };
}
