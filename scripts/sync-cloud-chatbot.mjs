#!/usr/bin/env node
/**
 * cloud-chatbot → TMS public/tools/cloud-chatbot (참고용 README)
 * 실제 UI는 Render origin iframe embed (src/constants/cloudChatbotEnv.js)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMS_ROOT = path.resolve(__dirname, '..');
const CHATBOT_ROOT = path.resolve(TMS_ROOT, '../cloud-chatbot');
const OUT = path.join(TMS_ROOT, 'public/tools/cloud-chatbot');

const PROD = 'https://cloud-chatbot-963d.onrender.com';

fs.mkdirSync(OUT, { recursive: true });

const readme = `# Cloud Chatbot (TMS embed)

TMS 메뉴 \`module=cloud-chatbot\` 에서 iframe으로 연동합니다.

- 운영 API/UI: ${PROD}
- 로컬 개발: \`VITE_CLOUD_CHATBOT_ORIGIN=http://127.0.0.1:9999\` (백엔드 기동 후)

소스: \`apps/cloud-chatbot\`
`;

fs.writeFileSync(path.join(OUT, 'README.md'), readme);

if (fs.existsSync(path.join(CHATBOT_ROOT, 'home.html'))) {
  fs.copyFileSync(path.join(CHATBOT_ROOT, 'home.html'), path.join(OUT, 'home.html'));
  console.log('Copied home.html →', OUT);
}

fs.writeFileSync(
  path.join(OUT, 'config.js'),
  `window.__CLOUD_CHATBOT_ORIGIN__ = ${JSON.stringify(process.env.VITE_CLOUD_CHATBOT_ORIGIN || PROD)};\n`
);

console.log('cloud-chatbot embed config OK — origin:', process.env.VITE_CLOUD_CHATBOT_ORIGIN || PROD);
