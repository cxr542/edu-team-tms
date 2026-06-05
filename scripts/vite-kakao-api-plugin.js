import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import kakaoHandler from '../api/kakao-local.js';

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
