import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PATHS, compareHeaders, expectedHeadersFor } from '../scripts/prod-security-headers-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const asHeaders = (obj) => new Headers(obj);

describe('production security header check', () => {
  it('expects base headers and exactly one CSP header for every checked path', () => {
    for (const pathname of PATHS) {
      const expected = expectedHeadersFor(vercel, pathname);
      expect(expected['x-content-type-options']).toBe('nosniff');
      const csp = ['content-security-policy', 'content-security-policy-report-only'].filter((k) => k in expected);
      expect(csp).toHaveLength(1);
    }
  });

  it('passes when the response matches vercel.json', () => {
    const expected = expectedHeadersFor(vercel, '/yhkim');
    expect(compareHeaders(expected, asHeaders(expected))).toEqual([]);
  });

  it('reports a changed value, a missing header and an unexpected CSP', () => {
    const expected = expectedHeadersFor(vercel, '/tools/cloud-chatbot/home.html');
    const actual = { ...expected, 'referrer-policy': 'unsafe-url', 'content-security-policy': "default-src 'self'" };
    delete actual['x-frame-options'];

    expect(compareHeaders(expected, asHeaders(actual))).toEqual([
      'referrer-policy 값이 다름',
      'x-frame-options 없음',
      'content-security-policy가 예상과 달리 붙음',
    ]);
  });
});
