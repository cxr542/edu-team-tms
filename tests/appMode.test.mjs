import { describe, expect, it, vi, afterEach } from 'vitest';
import { isEditorMode, isViewerMode } from '../src/utils/appMode.js';

describe('isViewerMode on scoped user paths', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats /yhkim ledger view as editor scope for navigation', () => {
    vi.stubGlobal('window', {
      location: {
        pathname: '/yhkim',
        search: '?mode=view&module=ledger&year=2026&month=6',
      },
    });
    expect(isViewerMode()).toBe(false);
    expect(isEditorMode()).toBe(true);
  });

  it('still treats public ?mode=view as viewer', () => {
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '?mode=view' },
    });
    expect(isViewerMode()).toBe(true);
  });
});
