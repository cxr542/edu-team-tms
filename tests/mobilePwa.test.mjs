import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = new URL('..', import.meta.url).pathname;

function readProjectFile(path) {
  return readFileSync(join(projectRoot, path), 'utf8');
}

describe('mobile PWA integration', () => {
  it('exposes installable manifest metadata for mobile browsers', () => {
    const manifest = JSON.parse(readProjectFile('public/manifest.webmanifest'));

    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        }),
        expect.objectContaining({
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: expect.stringContaining('maskable'),
        }),
      ]),
    );
  });

  it('registers a service worker so Android can offer app installation', () => {
    const main = readProjectFile('src/main.jsx');
    const worker = readProjectFile('public/sw.js');

    expect(main).toContain("navigator.serviceWorker.register('/sw.js')");
    expect(worker).toContain("const CACHE_NAME = 'edu-team-tms-mobile-v1'");
  });
});
