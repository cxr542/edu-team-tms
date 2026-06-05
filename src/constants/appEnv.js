import { TMS_ALT_ORIGIN, TMS_ORIGIN } from './appUrls';

/** package.json과 vite define에서 주입 (기본 1.0.0) */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

const PROD_HOSTS = new Set([
  'okestro-edu-team-tms.vercel.app',
  'edu-team-tms.vercel.app',
  'cxr542.github.io',
]);

const PROD_ORIGINS = new Set([TMS_ORIGIN, TMS_ALT_ORIGIN, 'https://cxr542.github.io']);

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

export function getEnvironmentLabel() {
  return isProductionEnvironment() ? '운영' : '개발';
}

export function getProductionAppUrl(mode = 'edit') {
  return mode === 'view' ? `${TMS_ORIGIN}/` : `${TMS_ORIGIN}/?mode=edit`;
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
