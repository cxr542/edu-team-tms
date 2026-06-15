import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  openAppModuleInNewTab,
  shouldAllowNativeModuleNavigation,
} from '../src/utils/appModuleNavigation.js';

describe('shouldAllowNativeModuleNavigation', () => {
  it('allows meta, ctrl, shift, alt, and middle-click', () => {
    expect(shouldAllowNativeModuleNavigation({ metaKey: true })).toBe(true);
    expect(shouldAllowNativeModuleNavigation({ ctrlKey: true })).toBe(true);
    expect(shouldAllowNativeModuleNavigation({ shiftKey: true })).toBe(true);
    expect(shouldAllowNativeModuleNavigation({ altKey: true })).toBe(true);
    expect(shouldAllowNativeModuleNavigation({ button: 1 })).toBe(true);
  });

  it('blocks plain left click for SPA handling', () => {
    expect(
      shouldAllowNativeModuleNavigation({
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
      }),
    ).toBe(false);
  });
});

describe('openAppModuleInNewTab', () => {
  it('opens href in a new tab with noopener', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });

    openAppModuleInNewTab('/?module=journal');
    expect(open).toHaveBeenCalledWith('/?module=journal', '_blank', 'noopener,noreferrer');

    vi.unstubAllGlobals();
  });
});

describe('AppShell sidebar navigation links', () => {
  const shellSource = readFileSync(
    path.join(process.cwd(), 'src/components/AppShell.jsx'),
    'utf8',
  );
  const navItemSource = readFileSync(
    path.join(process.cwd(), 'src/components/AppModuleNavItem.jsx'),
    'utf8',
  );

  it('uses AppModuleNavItem for sidebar modules', () => {
    expect(shellSource).toContain('AppModuleNavItem');
    expect(navItemSource).toContain('shouldAllowNativeModuleNavigation');
    expect(navItemSource).toContain('project-nav-item__new-tab');
  });

  it('offers current screen open in new tab from settings', () => {
    expect(shellSource).toContain('현재 화면 새 탭에서 열기');
    expect(shellSource).toContain('openAppModuleInNewTab(currentScreenHref)');
  });
});

describe('AppModuleLink modifier navigation', () => {
  const linkSource = readFileSync(
    path.join(process.cwd(), 'src/components/AppModuleLink.jsx'),
    'utf8',
  );

  it('preserves native navigation on modifier click', () => {
    expect(linkSource).toContain('shouldAllowNativeModuleNavigation');
  });
});
