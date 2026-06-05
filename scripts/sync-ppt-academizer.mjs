#!/usr/bin/env node
/**
 * ppt-academizer web → TMS public/tools/ppt-academizer
 * sibling ../ppt-academizer 가 없으면 repo에 포함된 vendored UI 유지
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMS_ROOT = path.resolve(__dirname, '..');
const WEB = path.resolve(TMS_ROOT, '../ppt-academizer/web');
const OUT = path.join(TMS_ROOT, 'public/tools/ppt-academizer');

const NETLIFY_API = 'https://ppt-academizer.netlify.app';
const NETLIFY_UI = 'https://ppt-academizer.netlify.app/';

fs.mkdirSync(OUT, { recursive: true });

const externalIndex = path.join(WEB, 'index.html');
const vendoredIndex = path.join(OUT, 'index.html');

if (fs.existsSync(externalIndex)) {
  fs.copyFileSync(externalIndex, vendoredIndex);
  console.log('Synced ppt-academizer from sibling repo ->', OUT);
} else if (fs.existsSync(vendoredIndex)) {
  console.log('Using vendored ppt-academizer UI in public/tools/ppt-academizer');
} else {
  console.error('ppt-academizer UI not found. Add public/tools/ppt-academizer/index.html');
  process.exit(1);
}

const isDev = process.env.TMS_ACADEMIZER_CONFIG === 'dev';
const apiBase = isDev ? '/ppt-academizer-api' : process.env.PPT_ACADEMIZER_API_URL || NETLIFY_API;

fs.writeFileSync(
  path.join(OUT, 'config.js'),
  `// TMS embed — API: ${apiBase || '(same-origin dev proxy)'}\n` +
    `window.__PPT_ACADEMIZER_API__ = ${JSON.stringify(apiBase)};\n` +
    `window.__PPT_ACADEMIZER_NETLIFY_URL__ = ${JSON.stringify(NETLIFY_UI)};\n`,
);

console.log('API base:', apiBase || '/ppt-academizer-api (dev proxy)');
