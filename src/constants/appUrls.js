/** 프로덕션 기본 URL (Vercel alias 동일 콘텐츠) */
export const TMS_ORIGIN = 'https://okestro-edu-team-tms.vercel.app';

/** 로컬 dev 서버 기본 (`npm run dev`, vite port 3000) */
export const TMS_DEV_ORIGIN = import.meta.env.VITE_DEV_TMS_ORIGIN || 'http://localhost:3000';

export const TMS_VIEW_URL = `${TMS_ORIGIN}/`;
export const TMS_EDIT_URL = `${TMS_ORIGIN}/?mode=edit`;

export const TMS_ALT_ORIGIN = 'https://edu-team-tms.vercel.app';
