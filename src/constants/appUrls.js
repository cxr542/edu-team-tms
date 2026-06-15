/** 프로덕션 기본 URL — Vercel에 VITE_TMS_ORIGIN 설정 권장 */
export const TMS_ORIGIN =
  import.meta.env.VITE_TMS_ORIGIN ||
  import.meta.env.VITE_DEPLOY_ORIGIN ||
  'https://edu-team-tms-ten.vercel.app';

/** 로컬 dev 서버 기본 (`npm run dev`, vite port 3000) */
export const TMS_DEV_ORIGIN = import.meta.env.VITE_DEV_TMS_ORIGIN || 'http://localhost:3000';

export const TMS_VIEW_URL = `${TMS_ORIGIN}/`;
export const TMS_EDIT_URL = `${TMS_ORIGIN}/?mode=edit`;

export const TMS_ALT_ORIGIN =
  import.meta.env.VITE_TMS_ALT_ORIGIN || 'https://edu-team-tms-ten.vercel.app';
