import { NAV_LABEL_IDS } from '../constants/navLabels.js';

/** 사이드바 메뉴 순서를 이 브라우저에 보관(캐시)하는 키. 정본은 팀 공유 저장소(nav_settings)이고, 이 값은 공유 저장소에 닿지 못할 때의 대비다. */
export const NAV_ORDER_STORAGE_KEY = 'tms-nav-order-v1';

/**
 * 관리자 사이드바의 그룹별 기본 순서. 순서를 바꿀 수 있는 그룹만 여기에 둔다.
 * 새 메뉴가 생기면 저장된 순서 맨 뒤에 붙는다(applyNavOrder).
 */
export const NAV_GROUP_DEFAULT_ORDER = {
  common: ['ledger', 'announcements', 'csr', 'lunch', 'lecture-journal', 'kanban', 'academizer', 'ai-office'],
  memberWork: ['journal', 'competency'],
  experimental: ['cloud-chatbot'],
  leader: ['kpi', 'kpi-report', 'kpi-approve'],
};

/** 저장된 순서를 기본 목록에 입히는 규칙: 저장된 것 중 아직 있는 메뉴를 먼저, 새 메뉴는 뒤에 */
export function applyNavOrder(defaults, saved) {
  const known = new Set(defaults);
  const seen = new Set();
  const head = [];
  (Array.isArray(saved) ? saved : []).forEach((id) => {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      head.push(id);
    }
  });
  return [...head, ...defaults.filter((id) => !seen.has(id))];
}

/** id 를 delta 칸(-1 위, +1 아래) 옮긴 새 목록. 끝을 넘으면 그대로 둔다. */
export function moveNavItem(order, id, delta) {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** localStorage 에서 읽은 값을 {그룹: [id…]} 로 정리. 알 수 없는 그룹·값은 버린다. */
export function sanitizeNavOrder(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  Object.keys(NAV_GROUP_DEFAULT_ORDER).forEach((group) => {
    if (Array.isArray(raw[group])) out[group] = raw[group].filter((id) => typeof id === 'string');
  });
  return out;
}

/** 한 메뉴를 묶음의 맨 위('top') 또는 맨 아래('bottom')로 보낸다. */
export function moveNavItemToEdge(order, id, edge) {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const to = edge === 'top' ? 0 : order.length - 1;
  if (from === to) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

const MAX_LABEL_LENGTH = 40;

/**
 * 팀 공유 저장소와 주고받는 메뉴 설정 {order, labels} 를 정리한다. 서버와 화면이 같은 규칙을 쓴다.
 * - order: 알려진 그룹의 문자열 id 목록만
 * - labels: 알려진 메뉴 id 의 비어 있지 않은 이름(40자까지)만
 */
export function sanitizeNavSettings(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const labels = {};
  const rawLabels = source.labels && typeof source.labels === 'object' && !Array.isArray(source.labels) ? source.labels : {};
  NAV_LABEL_IDS.forEach((id) => {
    const value = typeof rawLabels[id] === 'string' ? rawLabels[id].trim().slice(0, MAX_LABEL_LENGTH) : '';
    if (value) labels[id] = value;
  });
  return { order: sanitizeNavOrder(source.order), labels };
}

/** 기본 이름과 다른 것만 남긴다 (공유 저장소에는 바꾼 이름만 보낸다). */
export function diffNavLabels(labels, defaults) {
  const out = {};
  NAV_LABEL_IDS.forEach((id) => {
    const value = typeof labels?.[id] === 'string' ? labels[id].trim() : '';
    if (value && value !== defaults?.[id]) out[id] = value;
  });
  return out;
}
