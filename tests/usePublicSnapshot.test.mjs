import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('usePublicSnapshot polling policy', () => {
  it('keeps ledger polling disabled in App', () => {
    const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(appSource).toMatch(/pollMs:\s*0/);
    expect(appSource).not.toMatch(/pollMs:\s*isViewer\s*\?\s*5e3/);
  });

  it('does not block the whole app on snapshot errors', () => {
    const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(appSource).not.toMatch(/minHeight:\s*'100vh'.*다시 불러오기/s);
    expect(appSource).toContain('EMPTY_LEDGER_SNAPSHOT_TITLE');
  });
});
