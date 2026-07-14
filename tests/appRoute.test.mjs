import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_ROUTE_ADMIN,
  MEMBER_ROUTE_SLUG,
  adminRoutePath,
  buildAppScopedUrl,
  getModuleFromLocation,
  memberRoutePath,
  migrateLegacyAppUrlIfNeeded,
  parseAppRoute,
  resolveScopedPathname,
} from '../src/utils/appRoute.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appRoute path scopes', () => {
  it('parses admin and user paths', () => {
    expect(parseAppRoute({ pathname: '/admin', search: '?module=kpi&mode=edit' }).scope).toBe('admin');
    expect(parseAppRoute({ pathname: '/yhkim', search: '?module=journal&mode=edit' }).memberCode).toBe('A');
    expect(parseAppRoute({ pathname: '/wschoi', search: '' }).memberCode).toBe('B');
    expect(parseAppRoute({ pathname: '/hyshin', search: '' }).memberCode).toBe('C');
    expect(parseAppRoute({ pathname: '/hwshin', search: '' }).memberCode).toBe('C');
  });

  it('resolves scoped pathnames', () => {
    expect(resolveScopedPathname({ scope: 'admin' })).toBe('/admin');
    expect(resolveScopedPathname({ memberCode: 'A' })).toBe('/yhkim');
    expect(memberRoutePath('B')).toBe('/wschoi');
    expect(adminRoutePath()).toBe('/admin');
  });

  it('builds admin module URLs without access query', () => {
    const url = buildAppScopedUrl('kpi-approve', {
      access: 'admin',
      mode: 'edit',
      year: 2026,
      month: 6,
      inheritScope: false,
    });
    expect(url.pathname).toBe('/admin');
    expect(url.searchParams.get('module')).toBe('kpi-approve');
    expect(url.searchParams.get('access')).toBeNull();
    expect(url.searchParams.get('mode')).toBeNull();
  });

  it('builds user journal URLs as bare slug paths', () => {
    const url = buildAppScopedUrl('journal', {
      member: 'B',
      mode: 'edit',
      inheritScope: false,
    });
    expect(url.pathname).toBe('/wschoi');
    expect(url.searchParams.get('member')).toBeNull();
    expect(url.searchParams.get('module')).toBeNull();
    expect(url.searchParams.get('mode')).toBeNull();
    expect(`${url.pathname}${url.search}`).toBe('/wschoi');
  });

  it('defaults modules by scope', () => {
    expect(getModuleFromLocation({ pathname: '/admin', search: '' })).toBe('ledger');
    expect(getModuleFromLocation({ pathname: '/yhkim', search: '' })).toBe('journal');
    expect(getModuleFromLocation({ pathname: '/admin', search: '?module=announcements' })).toBe('announcements');
  });

  it('migrates legacy admin query to /admin path shape', () => {
    const route = parseAppRoute({
      pathname: '/',
      search: '?mode=edit&access=admin&module=kpi',
    });
    expect(route.legacy).toBe(true);
    expect(route.scope).toBe('admin');
    const url = buildAppScopedUrl('kpi', {
      access: 'admin',
      mode: 'edit',
      inheritScope: false,
    });
    expect(url.pathname).toBe('/admin');
    expect(url.searchParams.get('access')).toBeNull();
  });

  it('moves admin view member links to member scope before the gate check', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/admin',
        search: '?mode=view&module=competency&member=A&quarter=2',
        href: 'https://example.test/admin?mode=view&module=competency&member=A&quarter=2',
      },
      history: { replaceState },
    });

    expect(migrateLegacyAppUrlIfNeeded()).toBe(true);
    expect(replaceState).toHaveBeenCalledWith({}, '', '/yhkim?module=competency&quarter=2');
  });

  it('preserves member ledger view mode when moving admin view links to member scope', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/admin',
        search: '?mode=view&member=B',
        href: 'https://example.test/admin?mode=view&member=B',
      },
      history: { replaceState },
    });

    expect(migrateLegacyAppUrlIfNeeded()).toBe(true);
    expect(replaceState).toHaveBeenCalledWith({}, '', '/wschoi?mode=view&module=ledger');
  });

  it('maps member slugs', () => {
    expect(MEMBER_ROUTE_SLUG.A).toBe('yhkim');
    expect(MEMBER_ROUTE_SLUG.B).toBe('wschoi');
    expect(MEMBER_ROUTE_SLUG.C).toBe('hyshin');
    expect(APP_ROUTE_ADMIN).toBe('admin');
  });

  it('redirects legacy /hwshin slug to /hyshin', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/hwshin',
        search: '',
        href: 'https://example.test/hwshin',
      },
      history: { replaceState },
    });

    expect(migrateLegacyAppUrlIfNeeded()).toBe(true);
    expect(replaceState).toHaveBeenCalledWith({}, '', '/hyshin');
  });
});
