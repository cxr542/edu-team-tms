import { isProductionEnvironment } from './appEnv';
import { TMS_ORIGIN } from './appUrls';

/** 런처 목업 (cxr542-launcher 배포 전) */
export const WORKSPACE_MOCKUP_PATH = '/preview/cxr542-launcher-landing-mockup-20260605-131312.html';

/** 배포 예정 런처 origin */
export const WORKSPACE_LAUNCHER_ORIGIN = 'https://cxr542-launcher.vercel.app';

/**
 * 팀장 Workspace 랜딩 URL.
 * 런처 repo 배포 전에는 TMS에 호스팅된 목업 HTML을 사용합니다.
 */
export function getWorkspaceUrl() {
  if (typeof window === 'undefined') {
    return `${TMS_ORIGIN}${WORKSPACE_MOCKUP_PATH}`;
  }

  if (isProductionEnvironment()) {
    return `${TMS_ORIGIN}${WORKSPACE_MOCKUP_PATH}`;
  }

  const { origin } = window.location;
  return `${origin}${WORKSPACE_MOCKUP_PATH}`;
}
