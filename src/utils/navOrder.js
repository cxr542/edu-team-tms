/** 사이드바 메뉴 순서를 브라우저별로 저장하는 키 (메뉴 이름 저장소와 같은 방식) */
export const NAV_ORDER_STORAGE_KEY = 'tms-nav-order-v1';

/**
 * 관리자 사이드바의 그룹별 기본 순서. 순서를 바꿀 수 있는 그룹만 여기에 둔다.
 * 새 메뉴가 생기면 저장된 순서 맨 뒤에 붙는다(applyNavOrder).
 */
export const NAV_GROUP_DEFAULT_ORDER = {
  common: ['ledger', 'announcements', 'csr', 'lunch', 'lecture-journal', 'kanban', 'ai-office'],
  memberWork: ['journal', 'competency'],
  experimental: ['academizer', 'cloud-chatbot'],
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
