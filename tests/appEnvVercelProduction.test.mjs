import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Vercel production deploy detection', () => {
  const viteConfig = readFileSync(path.join(process.cwd(), 'vite.config.js'), 'utf8');
  const appEnvSource = readFileSync(path.join(process.cwd(), 'src/constants/appEnv.js'), 'utf8');
  const appUrlsSource = readFileSync(path.join(process.cwd(), 'src/constants/appUrls.js'), 'utf8');

  it('injects Vercel build metadata for production origin', () => {
    expect(viteConfig).toContain('VITE_VERCEL_ENV');
    expect(viteConfig).toContain('VITE_DEPLOY_ORIGIN');
    expect(viteConfig).toContain('VERCEL_PROJECT_PRODUCTION_URL');
  });

  it('treats Vercel production builds as production environment', () => {
    expect(appEnvSource).toContain("import.meta.env.VITE_VERCEL_ENV === 'production'");
  });

  it('falls back to deploy origin for TMS_ORIGIN', () => {
    expect(appUrlsSource).toContain('VITE_DEPLOY_ORIGIN');
  });
});
