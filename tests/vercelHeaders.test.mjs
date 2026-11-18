import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const BASE_HEADERS = ['X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Permissions-Policy'];
const CSP = 'Content-Security-Policy';
const CSP_REPORT_ONLY = 'Content-Security-Policy-Report-Only';

const ENFORCED_PATHS = [
  '/',
  '/yhkim',
  '/admin',
  '/index.html',
  '/assets/index-abc123.js',
  '/api/announcements',
  '/sw.js',
  '/docs/reference/lecture-guides/viola-3.0.6/guide.html',
];
const REPORT_ONLY_PATHS = [
  '/tools/cloud-chatbot/home.html',
  '/tools/ppt-academizer/index.html',
  '/preview/cxr542-launcher-mockup.html',
];

// Vercel matches `source` with path-to-regexp; the sources here are plain regex groups, so an
// anchored RegExp gives the same result for these paths.
function headersFor(pathname) {
  const result = [];
  for (const rule of vercel.headers) {
    if (new RegExp(`^${rule.source}$`).test(pathname)) result.push(...rule.headers);
  }
  return result;
}

function directives(policy) {
  return Object.fromEntries(
    policy
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );
}

function indexInlineScriptHash() {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const bodies = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((body) => body.trim());
  return bodies.map((body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
}

describe('vercel.json security headers', () => {
  it.each([...ENFORCED_PATHS, ...REPORT_ONLY_PATHS])('%s gets the base security headers', (pathname) => {
    const keys = headersFor(pathname).map((h) => h.key);
    for (const key of BASE_HEADERS) expect(keys).toContain(key);
  });

  it.each(ENFORCED_PATHS)('%s gets exactly one enforced CSP and no Report-Only', (pathname) => {
    const csp = headersFor(pathname).filter((h) => h.key === CSP || h.key === CSP_REPORT_ONLY);
    expect(csp.map((h) => h.key)).toEqual([CSP]);
  });

  it.each(REPORT_ONLY_PATHS)('%s gets exactly one Report-Only CSP', (pathname) => {
    const csp = headersFor(pathname).filter((h) => h.key === CSP || h.key === CSP_REPORT_ONLY);
    expect(csp.map((h) => h.key)).toEqual([CSP_REPORT_ONLY]);
  });

  it('keeps every enforced policy strict', () => {
    const policies = vercel.headers.flatMap((rule) => rule.headers).filter((h) => h.key === CSP);
    expect(policies.length).toBeGreaterThan(0);
    for (const { value } of policies) {
      const d = directives(value);
      expect(d['script-src']).toBeDefined();
      for (const weak of ["'unsafe-inline'", "'unsafe-eval'", '*', 'https:', 'http:', 'data:']) {
        expect(d['script-src']).not.toContain(weak);
      }
      for (const name of ['connect-src', 'frame-src']) {
        expect(d[name] || []).not.toContain('*');
      }
      expect(d['object-src']).toEqual(["'none'"]);
      expect(d['base-uri']).toEqual(["'self'"]);
      expect(d['frame-ancestors']).toEqual(["'self'"]);
    }
  });

  it("allows index.html's inline script by hash on app routes", () => {
    const appPolicy = headersFor('/yhkim').find((h) => h.key === CSP)?.value || '';
    const scriptSrc = directives(appPolicy)['script-src'] || [];
    const hashes = indexInlineScriptHash();
    expect(hashes.length).toBeGreaterThan(0);
    for (const hash of hashes) expect(scriptSrc).toContain(hash);
  });
});
