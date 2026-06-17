/** 현재 운영 (경로 URL · Blob · 관리자 게이트) */
export const TMS_V1_ORIGIN = 'https://edu-team-tms-ten.vercel.app';

/** 예비 hostname — Vercel 도메인 확보 전까지 미사용 */
export const TMS_V2_ORIGIN = 'https://okestro-edu-tms-v2.vercel.app';

/** 프로덕션 기본 URL — Vercel에 VITE_TMS_ORIGIN 설정 권장 */
export const TMS_ORIGIN =
  import.meta.env.VITE_TMS_ORIGIN ||
  import.meta.env.VITE_DEPLOY_ORIGIN ||
  TMS_V1_ORIGIN;

/** 로컬 dev 서버 기본 (`npm run dev`, vite port 3000) */
export const TMS_DEV_ORIGIN = import.meta.env.VITE_DEV_TMS_ORIGIN || 'http://localhost:3000';

export const TMS_VIEW_URL = `${TMS_ORIGIN}/`;
export const TMS_EDIT_URL = `${TMS_ORIGIN}/?mode=edit`;

/** 옛 운영 origin (이전 URL 안내·교차 origin 허용) */
export const TMS_ALT_ORIGIN =
  import.meta.env.VITE_TMS_ALT_ORIGIN || 'https://okestro-edu-team-tms.vercel.app';
