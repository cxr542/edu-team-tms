import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUIDES_DIR = path.join(ROOT, 'docs/reference-source/lecture-guides');

function listHtml(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listHtml(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function inlineScriptHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((body) => body.trim())
    .map((body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
}

function cspFor(source, key) {
  const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const rule = vercel.headers.find((h) => h.source === source);
  return rule?.headers.find((h) => h.key === key)?.value || '';
}

describe('CSP for /docs lecture guides', () => {
  it('allows every inline script in docs/reference-source/lecture-guides by hash', () => {
    const policy = cspFor('/docs/(.*)', 'Content-Security-Policy');
    const scriptSrc = policy.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src ')) || '';
    const files = listHtml(GUIDES_DIR);
    expect(files.length).toBeGreaterThan(0);

    const missing = files.flatMap((file) =>
      inlineScriptHashes(readFileSync(file, 'utf8'))
        .filter((hash) => !scriptSrc.split(/\s+/).includes(hash))
        .map((hash) => `${path.relative(ROOT, file)} ${hash}`),
    );
    // 가이드의 인라인 스크립트가 바뀌면 vercel.json의 /docs/(.*) script-src 해시도 함께 바꿔야 한다.
    expect(missing).toEqual([]);
  });
});
