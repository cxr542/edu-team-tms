import { isProductionEnvironment } from './appEnv';

/** 배포된 런처 */
export const WORKSPACE_LAUNCHER_ORIGIN = 'https://cxr542-launcher.vercel.app';

/** 로컬 런처 (`npm run dev` in cxr542-launcher) */
export const WORKSPACE_LAUNCHER_DEV_ORIGIN =
  import.meta.env.VITE_LAUNCHER_ORIGIN || 'http://localhost:4321';

/** TMS 호스팅 목업 (런처 dev 미기동 시 fallback) */
export const WORKSPACE_MOCKUP_PATH = '/preview/cxr542-launcher-landing-mockup-20260605-131312.html';

/**
 * 팀장 Workspace 랜딩 URL.
 * 운영: cxr542-launcher.vercel.app · 로컬: 런처 dev 서버(4321)
 */
export function getWorkspaceUrl() {
  if (typeof window === 'undefined') {
    return `${WORKSPACE_LAUNCHER_ORIGIN}/`;
  }

  if (isProductionEnvironment()) {
    return `${WORKSPACE_LAUNCHER_ORIGIN}/`;
  }

  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${WORKSPACE_LAUNCHER_DEV_ORIGIN}/`;
  }

  return `${window.location.origin}${WORKSPACE_MOCKUP_PATH}`;
}
