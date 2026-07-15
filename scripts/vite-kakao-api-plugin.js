import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import kakaoHandler from '../api/kakao-local.js';
import confluenceLectureHandler from '../api/confluence-lecture.js';
import announcementReactionsHandler from '../api/announcement-reactions.js';
import announcementCommentsHandler from '../api/announcement-comments.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
// scripts/ 아래이므로 부모 폴더가 TMS 앱 루트입니다.
const tmsAppRoot = path.resolve(thisDir, '..');

let cachedApiKey = '';
try {
  // mode에 관계없이 .env.local을 로드하므로 dev 모드로 캐싱합니다.
  const env = loadEnv('development', tmsAppRoot, '');
  cachedApiKey = env.KAKAO_REST_API_KEY?.trim() || '';
} catch {
  cachedApiKey = process.env.KAKAO_REST_API_KEY?.trim() || '';
}

const PROD_TMS_ORIGIN = 'https://edu-team-tms-ten.vercel.app';
const PROD_SNAPSHOT_API_PATHS = new Set([
  '/api/journal-snapshot',
  '/api/ledger-snapshot',
  '/api/kpi-operational-snapshot',
  '/api/improve-projects-snapshot',
]);

let prodProxyWarned = false;

function isProdSnapshotProxyEnabled() {
  try {
    const env = loadEnv('development', tmsAppRoot, '');
    return env.VITE_PROD_SNAPSHOT_PROXY === 'true';
  } catch {
    return process.env.VITE_PROD_SNAPSHOT_PROXY === 'true';
  }
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/**
 * Vite dev only — GET snapshot APIs → 운영 Blob (read-only).
 * POST/PUT/PATCH/DELETE 등 쓰기 method는 운영으로 전달하지 않음.
 */
export function prodSnapshotReadProxyPlugin() {
  return {
    name: 'tms-prod-snapshot-read-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (!PROD_SNAPSHOT_API_PATHS.has(pathname)) {
          next();
          return;
        }

        if (!isProdSnapshotProxyEnabled()) {
          next();
          return;
        }

        if (!prodProxyWarned) {
          prodProxyWarned = true;
          console.warn(
            '[tms] VITE_PROD_SNAPSHOT_PROXY=true — dev가 운영 Blob snapshot GET을 프록시합니다. 용량 보호를 위해 기본 OFF입니다.'
          );
        }

        const method = (req.method || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD') {
          sendJson(res, 403, { error: 'dev-write-blocked' });
          return;
        }

        try {
          const prodRes = await fetch(`${PROD_TMS_ORIGIN}${req.url}`, {
            method,
            headers: {
              referer: `${PROD_TMS_ORIGIN}/`,
              origin: PROD_TMS_ORIGIN,
            },
            cache: 'no-store',
          });

          res.statusCode = prodRes.status;
          res.setHeader('Cache-Control', 'no-store');
          const contentType = prodRes.headers.get('content-type');
          if (contentType) {
            res.setHeader('Content-Type', contentType);
          }

          const body = Buffer.from(await prodRes.arrayBuffer());
          res.end(body);
        } catch (err) {
          sendJson(res, 502, { error: err.message || String(err) });
        }
      });
    },
  };
}

/** Vite dev: /api/kakao-local → api/kakao-local.js ( .env.local 의 KAKAO_REST_API_KEY 사용 ) */
export function kakaoApiDevPlugin() {
  return {
    name: 'tms-kakao-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/kakao-local')) {
          next();
          return;
        }

        // dev 실행 위치(cwd)가 달라도 TMS 앱의 .env.local을 항상 읽도록 고정합니다.
        const env = loadEnv(server.config.mode, tmsAppRoot, '');
        const apiKey =
          env.KAKAO_REST_API_KEY?.trim() ||
          process.env.KAKAO_REST_API_KEY?.trim() ||
          cachedApiKey ||
          '';

        try {
          // Handler가 options/apiKey를 못 받는 케이스에도 대비
          process.env.KAKAO_REST_API_KEY = apiKey;
          await kakaoHandler(req, res, { apiKey });
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

/** Vite dev: announcement reactions/comments APIs */
export function announcementEngagementApiDevPlugin() {
  return {
    name: 'tms-announcement-engagement-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        let handler = null;
        if (path === '/api/announcement-reactions') handler = announcementReactionsHandler;
        else if (path === '/api/announcement-comments') handler = announcementCommentsHandler;
        else {
          next();
          return;
        }

        const env = loadEnv(server.config.mode, tmsAppRoot, '');
        if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
        if (env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
        if (env.SUPABASE_SERVICE_ROLE_KEY) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
        }

        try {
          await handler(req, res);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

/** Vite dev: /api/confluence-lecture → api/confluence-lecture.js */
export function confluenceLectureApiDevPlugin() {
  return {
    name: 'tms-confluence-lecture-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/confluence-lecture')) {
          next();
          return;
        }

        const env = loadEnv(server.config.mode, tmsAppRoot, '');
        const merged = {
          ...process.env,
          CONFLUENCE_BASE_URL: env.CONFLUENCE_BASE_URL || process.env.CONFLUENCE_BASE_URL,
          CONFLUENCE_EMAIL: env.CONFLUENCE_EMAIL || process.env.CONFLUENCE_EMAIL,
          CONFLUENCE_API_TOKEN: env.CONFLUENCE_API_TOKEN || process.env.CONFLUENCE_API_TOKEN,
          CONFLUENCE_LECTURE_FOLDER_ID:
            env.CONFLUENCE_LECTURE_FOLDER_ID || process.env.CONFLUENCE_LECTURE_FOLDER_ID,
          CONFLUENCE_LECTURE_PARENT_TYPE:
            env.CONFLUENCE_LECTURE_PARENT_TYPE || process.env.CONFLUENCE_LECTURE_PARENT_TYPE,
          CONFLUENCE_SPACE_KEY: env.CONFLUENCE_SPACE_KEY || process.env.CONFLUENCE_SPACE_KEY,
        };

        try {
          await confluenceLectureHandler(req, res, { env: merged });
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}
