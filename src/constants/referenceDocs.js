/** @typedef {'definition' | 'ops' | 'release' | 'source'} RefDocCategory */

/** @typedef {{ id: string, category: RefDocCategory, title: string, file: string, summary?: string, pinned?: boolean }} ReferenceDocMeta */

export const REF_DOC_CATEGORIES = {
  definition: 'KPI 정의',
  ops: 'TMS 운영',
  release: '릴리즈 노트',
  source: 'v5 원문 발췌',
};

/** public/docs/reference/ 기준 파일명 */
export const REFERENCE_DOCS = /** @type {ReferenceDocMeta[]} */ ([
  {
    id: 'kpi-definition',
    category: 'definition',
    title: '교육팀 KPI 정의서',
    file: '교육팀_KPI_정의서.md',
    summary: '교육팀_KPI_정의서_최종v5.docx 추출 · KPI1~3',
    pinned: true,
  },
  {
    id: 'kpi-v5-kpi1',
    category: 'source',
    title: 'KPI 정의서 v5 — KPI1',
    file: 'sources/교육팀_KPI_정의서_v5_KPI1.md',
    summary: '가동률 발췌',
  },
  {
    id: 'kpi-v5-kpi2',
    category: 'source',
    title: 'KPI 정의서 v5 — KPI2',
    file: 'sources/교육팀_KPI_정의서_v5_KPI2.md',
    summary: '생산성 발췌',
  },
  {
    id: 'tms-ops-v2',
    category: 'ops',
    title: 'TMS KPI 운영 모델 v2',
    file: 'KPI-TMS-운영모델-v2.md',
    summary: 'SoT·역할·엑셀 관계',
  },
  {
    id: 'tms-bookmarks',
    category: 'ops',
    title: 'TMS 접속 URL · 북마크',
    file: 'TMS-접속URL-북마크.md',
    summary: '팀장·팀원별 운영 URL · 북마크 표',
    pinned: true,
  },
  {
    id: 'tms-url-migration',
    category: 'ops',
    title: '운영 URL 이전 가이드',
    file: 'TMS-운영URL-이전-가이드.md',
    summary: 'edu-team-tms-ten 전환 · 북마크 · 일지 JSON 이전',
    pinned: true,
  },
  {
    id: 'tms-blob-fallback-ops',
    category: 'ops',
    title: 'Blob 중단 — 장부·일지 운영',
    file: 'TMS-Blob중단-장부일지-운영가이드.md',
    summary: 'Blob suspend 기간 팀장·팀원 할 일 (JSON·배포)',
    pinned: true,
  },
  {
    id: 'tms-kpi-menu',
    category: 'ops',
    title: '팀 KPI 메뉴·URL',
    file: 'KPI-TMS-팀KPI메뉴.md',
  },
  {
    id: 'tms-journal-link',
    category: 'ops',
    title: '일지 ↔ TMS 연계 가이드',
    file: 'KPI-일지-TMS-연계-가이드.md',
  },
  {
    id: 'tms-academizer',
    category: 'ops',
    title: 'Academizer 시나리오 예시',
    file: 'KPI-Academizer-TMS-시나리오예시.md',
  },
  {
    id: 'tms-pilot',
    category: 'ops',
    title: '파일럿 체크리스트 v2',
    file: 'pilot-checklist-v2-tms.md',
  },
  {
    id: 'tms-trace',
    category: 'ops',
    title: 'TMS ↔ 엑셀 매핑',
    file: 'KPI-TMS-traceability-tms.md',
  },
  {
    id: 'tms-competency-design',
    category: 'ops',
    title: '역량평가 설계노트',
    file: '교육팀_역량평가_설계노트.md',
    summary: 'KPI3 레벨·5차원 평가·0.2 누적·40:60',
  },
  {
    id: 'tms-release',
    category: 'release',
    title: 'TMS · KPI 릴리즈 노트',
    file: 'TMS-릴리즈노트.md',
    summary: 'TMS·KPI 기능 변경 이력',
    pinned: true,
  },
]);

export const DEFAULT_REFERENCE_DOC_ID = 'kpi-definition';

/** 왼쪽 문서 메뉴에 표시할 항목 */
export const REFERENCE_DOCS_NAV_IDS = [
  'tms-bookmarks',
  'tms-blob-fallback-ops',
  'kpi-definition',
  'tms-release',
];

export const REFERENCE_DOCS_NAV = REFERENCE_DOCS_NAV_IDS.map(
  (id) => REFERENCE_DOCS.find((d) => d.id === id)
).filter(Boolean);

export function isReferenceDocInNav(id) {
  return REFERENCE_DOCS_NAV_IDS.includes(id);
}

export function findReferenceDoc(id) {
  return REFERENCE_DOCS.find((d) => d.id === id) || null;
}

/** 마크다운 상대 링크(./foo.md) → 참고문서 id */
export function resolveReferenceDocIdFromHref(href) {
  if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
    return null;
  }
  const normalized = decodeURIComponent(String(href).replace(/^\.\//, '').split('#')[0].split('?')[0]);
  if (!normalized.endsWith('.md')) return null;
  const baseName = normalized.split('/').pop();
  const doc =
    REFERENCE_DOCS.find((d) => d.file === normalized) ||
    REFERENCE_DOCS.find((d) => d.file === baseName) ||
    REFERENCE_DOCS.find((d) => d.file.split('/').pop() === baseName);
  return doc?.id || null;
}

export function referenceDocPublicUrl(file) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}docs/reference/${encodeURI(file)}`;
}

export function buildDocsModuleUrl(docId, { mode = 'edit', year, month } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', mode);
  url.searchParams.set('module', 'docs');
  if (docId) url.searchParams.set('doc', docId);
  else url.searchParams.delete('doc');
  if (year != null) url.searchParams.set('year', String(year));
  if (month != null) url.searchParams.set('month', String(month));
  return `${url.pathname}${url.search}`;
}

/** 참고문서 직링크 (현재 origin·mode 유지, module=docs 고정) */
export function buildReferenceDocHref(docId, { mode = 'edit' } = {}) {
  const url = new URL(window.location.href);
  if (mode) url.searchParams.set('mode', mode);
  url.searchParams.set('module', 'docs');
  if (docId) url.searchParams.set('doc', docId);
  return `${url.pathname}${url.search}`;
}

/** 참고문서로 추가 검토한 항목 (아직 미포함) */
export const REFERENCE_DOCS_CANDIDATES = [
  { title: '교육팀 KPI 운영 엑셀 설계안', path: 'kpi-app-new/docs/교육팀_KPI_운영_엑셀_설계안.md' },
  { title: 'KPI 시뮬레이터 가이드', path: 'kpi-app-new/docs/simulator-guide.md' },
  { title: '강사 데모 매뉴얼', path: 'kpi-app-new/docs/강사-데모-매뉴얼-20260531-143644.md' },
];
