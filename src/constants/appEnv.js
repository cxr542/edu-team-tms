import { TMS_ALT_ORIGIN, TMS_DEV_ORIGIN, TMS_ORIGIN } from './appUrls';
import { URL_ACCESS_LEADER } from './teamAccess';

/** package.json과 vite define에서 주입 (기본 1.0.0) */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

function hostFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

const PROD_HOSTS = new Set([
  hostFromOrigin(TMS_ORIGIN),
  hostFromOrigin(TMS_ALT_ORIGIN),
  hostFromOrigin(import.meta.env.VITE_DEPLOY_ORIGIN || ''),
  'okestro-edu-team-tms.vercel.app',
  'edu-team-tms.vercel.app',
  'edu-team-tms-ten.vercel.app',
  'cxr542.github.io',
].filter(Boolean));

const PROD_ORIGINS = new Set([
  TMS_ORIGIN,
  TMS_ALT_ORIGIN,
  import.meta.env.VITE_DEPLOY_ORIGIN,
  'https://cxr542.github.io',
].filter(Boolean));

/** UI·문서용 짧은 버전 (1.0.0 → v1.0) */
export function formatAppVersion(version = APP_VERSION) {
  const [major, minor] = String(version).split('.');
  if (major != null && minor != null) return `v${major}.${minor}`;
  return `v${version}`;
}

/**
 * idea-bank와 같이 origin 기준 운영/개발 구분.
 * - 운영: Vercel 프로덕션 alias, GitHub Pages edu-team-tms
 * - 개발: localhost, Vercel 프리뷰 URL 등
 */
export function getAppEnvironment() {
  if (typeof window === 'undefined') return 'development';

  // Vercel Production 배포 빌드 — preview·localhost 제외
  if (import.meta.env.VITE_VERCEL_ENV === 'production') {
    return 'production';
  }

  const { hostname, protocol, pathname, origin } = window.location;
  if (protocol === 'file:') return 'development';

  if (PROD_ORIGINS.has(origin.replace(/\/$/, ''))) {
    return 'production';
  }

  if (hostname.endsWith('.github.io')) {
    return pathname.includes('/edu-team-tms') ? 'production' : 'development';
  }

  if (PROD_HOSTS.has(hostname)) {
    return 'production';
  }

  return 'development';
}

export function isProductionEnvironment() {
  return getAppEnvironment() === 'production';
}

/** Vercel preview/production 빌드 — API·Blob 수동 공유 저장 허용 (localhost 제외) */
export function isVercelDeployedEnvironment() {
  const env = import.meta.env.VITE_VERCEL_ENV;
  return env === 'production' || env === 'preview';
}

export function getEnvironmentLabel() {
  return isProductionEnvironment() ? '운영' : '개발';
}

export function getProductionAppUrl(mode = 'edit') {
  return mode === 'view' ? `${TMS_ORIGIN}/` : `${TMS_ORIGIN}/?mode=edit`;
}

const DEV_URL_PARAMS = ['module', 'member', 'year', 'month', 'quarter', 'doc'];

/** 운영 → 로컬 dev (`npm run dev`) 팀장 화면 URL. 현재 module·기간 등은 유지 */
export function getDevelopmentAppUrl(currentHref) {
  const href = currentHref || (typeof window !== 'undefined' ? window.location.href : '');
  const baseOrigin =
    !isProductionEnvironment() && typeof window !== 'undefined'
      ? window.location.origin
      : TMS_DEV_ORIGIN;
  const dev = new URL(`${baseOrigin}/`);
  dev.searchParams.set('mode', 'edit');
  dev.searchParams.set('access', URL_ACCESS_LEADER);

  if (href) {
    const cur = new URL(href);
    DEV_URL_PARAMS.forEach((key) => {
      const value = cur.searchParams.get(key);
      if (value) dev.searchParams.set(key, value);
    });
  }

  return `${dev.origin}${dev.pathname}${dev.search}`;
}

/** 팀장 편집 툴바 — 운영·로컬 dev 모두 dev URL 링크 표시 (구성원·조회 제외) */
export function canShowLeaderDevUrlLink({
  isViewer = false,
  isPublicViewerScope = false,
  teamAccess = null,
} = {}) {
  if (isViewer || isPublicViewerScope) return false;
  if (!teamAccess?.isLeader || teamAccess?.isMemberScope) return false;
  return true;
}

export function getEnvironmentBannerMeta({ isViewer }) {
  const version = formatAppVersion();
  const modeHint = isViewer ? '조회' : '작성';

  if (isProductionEnvironment()) {
    return {
      envLabel: '운영',
      meta: `🚀 ${version} · ${modeHint} · 공개 스냅샷 동기화`,
      devWarning: null,
    };
  }

  return {
    envLabel: '개발',
    meta: `🔧 ${version} · ${modeHint} · 브라우저별 로컬 저장 (운영 URL과 분리)`,
    devWarning: '개발 환경입니다. 실제 장부·일지는 운영 URL에서 관리하세요.',
  };
}
