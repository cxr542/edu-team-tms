/** 조회(/) 화면에 노출 가능한 메뉴 */

export const VIEWER_MENU_STORAGE_KEY = 'tms-viewer-menu-v1';

/** @typedef {'ledger' | 'lunch' | 'csr' | 'lecture-journal' | 'kpi-report' | 'kpi-approve' | 'docs'} ViewerMenuModuleId */

/** @type {ViewerMenuModuleId[]} */
export const VIEWER_MENU_MODULE_IDS = [
  'ledger',
  'lunch',
  'csr',
  'lecture-journal',
  'kpi-report',
  'kpi-approve',
  'docs',
];

/** @type {Record<ViewerMenuModuleId, boolean>} */
export const DEFAULT_VIEWER_MENU_VISIBILITY = {
  ledger: true,
  lunch: false,
  csr: false,
  'lecture-journal': false,
  'kpi-report': false,
  'kpi-approve': false,
  docs: false,
};

/** @type {{ id: ViewerMenuModuleId, required: boolean, description: string }[]} */
export const VIEWER_MENU_OPTIONS = [
  {
    id: 'ledger',
    required: true,
    description: '팀 빌딩비 장부 (조회 URL 기본 화면, 항상 표시)',
  },
  {
    id: 'lunch',
    required: false,
    description: '오늘 뭐 먹지 · 팀원 조회용',
  },
  {
    id: 'csr',
    required: false,
    description: '이것도(CSR) · 팀원 조회용',
  },
  {
    id: 'lecture-journal',
    required: false,
    description: '강의일지 (Confluence) · 팀원 조회용',
  },
  {
    id: 'kpi-report',
    required: false,
    description: 'KPI 리포트 · 팀원 조회용',
  },
  {
    id: 'kpi-approve',
    required: false,
    description: 'KPI 승인 · 팀원 조회용',
  },
  {
    id: 'docs',
    required: false,
    description: '참고문서 (KPI 정의서·릴리즈 노트 등)',
  },
];

/** @param {Record<string, boolean> | null | undefined} raw */
export function normalizeViewerMenuVisibility(raw) {
  const next = { ...DEFAULT_VIEWER_MENU_VISIBILITY };
  if (!raw || typeof raw !== 'object') return next;
  // legacy key from module=idea-bank era
  if (typeof raw['idea-bank'] === 'boolean' && typeof raw.csr !== 'boolean') {
    next.csr = raw['idea-bank'];
  }
  for (const id of VIEWER_MENU_MODULE_IDS) {
    if (typeof raw[id] === 'boolean') next[id] = raw[id];
  }
  next.ledger = true;
  return next;
}

/** @param {string} moduleId */
export function isViewerMenuModule(moduleId) {
  return VIEWER_MENU_MODULE_IDS.includes(moduleId);
}

/**
 * @param {string} moduleId
 * @param {Record<ViewerMenuModuleId, boolean>} visibility
 */
export function isModuleVisibleInViewer(moduleId, visibility) {
  if (moduleId === 'ledger') return true;
  if (!isViewerMenuModule(moduleId)) return false;
  return Boolean(visibility[moduleId]);
}

/**
 * @param {string} moduleId
 * @param {Record<ViewerMenuModuleId, boolean>} visibility
 */
export function resolveViewerModule(moduleId, visibility) {
  return isModuleVisibleInViewer(moduleId, visibility) ? moduleId : 'ledger';
}
