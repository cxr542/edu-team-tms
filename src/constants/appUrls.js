/** 프로덕션 기본 URL — 새 Vercel 계정이면 VITE_TMS_ORIGIN 으로 덮어씀 */
export const TMS_ORIGIN =
  import.meta.env.VITE_TMS_ORIGIN || 'https://okestro-edu-team-tms.vercel.app';

/** 로컬 dev 서버 기본 (`npm run dev`, vite port 3000) */
export const TMS_DEV_ORIGIN = import.meta.env.VITE_DEV_TMS_ORIGIN || 'http://localhost:3000';

export const TMS_VIEW_URL = `${TMS_ORIGIN}/`;
export const TMS_EDIT_URL = `${TMS_ORIGIN}/?mode=edit`;

export const TMS_ALT_ORIGIN =
  import.meta.env.VITE_TMS_ALT_ORIGIN || 'https://edu-team-tms.vercel.app';
