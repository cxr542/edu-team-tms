/**
 * 브라우저 임시 캐시 정리 규칙. 지워도 화면이 다시 만들어 주는 순수 캐시 키만 허용 목록(allowlist)에 둔다.
 * 일지·장부·KPI·메뉴 설정 같은 운영 데이터 키는 절대 넣지 않는다(허용 목록에 없으면 건드리지 않음).
 */
import { KAKAO_SEARCH_CACHE_KEY, LUNCH_SESSION_EXCLUDE_KEY } from '../constants/lunchPick.js';

export const BROWSER_CACHE_ENTRIES = [
  { storage: 'session', key: KAKAO_SEARCH_CACHE_KEY, label: '카카오 장소 검색 캐시' },
  { storage: 'session', key: LUNCH_SESSION_EXCLUDE_KEY, label: '점심 「오늘 제외」 목록' },
];

function store(storages, kind) {
  return kind === 'session' ? storages.session : storages.local;
}

/** 허용 목록 중 지금 저장돼 있는 항목 [{storage, key, label, bytes}] */
export function listCacheEntries(storages) {
  const found = [];
  for (const entry of BROWSER_CACHE_ENTRIES) {
    try {
      const value = store(storages, entry.storage)?.getItem(entry.key);
      if (value != null) found.push({ ...entry, bytes: value.length });
    } catch {
      // 저장소를 읽을 수 없으면 없는 것으로 본다
    }
  }
  return found;
}

/** 허용 목록 항목만 지우고, 되돌리기용 스냅샷 [{storage, key, value}] 을 돌려준다 */
export function clearCacheEntries(storages) {
  const snapshot = [];
  for (const entry of BROWSER_CACHE_ENTRIES) {
    try {
      const target = store(storages, entry.storage);
      const value = target?.getItem(entry.key);
      if (value == null) continue;
      snapshot.push({ storage: entry.storage, key: entry.key, value });
      target.removeItem(entry.key);
    } catch {
      // 지우지 못한 항목은 스냅샷에 넣지 않는다
    }
  }
  return snapshot;
}

/** 스냅샷을 되돌린다. 허용 목록에 없는 키는 무시한다. 되돌린 개수를 돌려준다 */
export function restoreCacheEntries(storages, snapshot) {
  const allowed = new Set(BROWSER_CACHE_ENTRIES.map((e) => `${e.storage}:${e.key}`));
  let restored = 0;
  for (const item of Array.isArray(snapshot) ? snapshot : []) {
    if (!allowed.has(`${item?.storage}:${item?.key}`) || typeof item.value !== 'string') continue;
    try {
      store(storages, item.storage)?.setItem(item.key, item.value);
      restored += 1;
    } catch {
      // 쓰기 실패는 건너뛴다
    }
  }
  return restored;
}

export function browserStorages() {
  return { session: window.sessionStorage, local: window.localStorage };
}
