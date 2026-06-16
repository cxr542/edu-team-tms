import { describe, expect, it } from 'vitest';
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

describe('appRoute path scopes', () => {
  it('parses admin and user paths', () => {
    expect(parseAppRoute({ pathname: '/admin', search: '?module=kpi&mode=edit' }).scope).toBe('admin');
    expect(parseAppRoute({ pathname: '/yhkim', search: '?module=journal&mode=edit' }).memberCode).toBe('A');
    expect(parseAppRoute({ pathname: '/wschoi', search: '' }).memberCode).toBe('B');
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

  it('maps member slugs', () => {
    expect(MEMBER_ROUTE_SLUG.A).toBe('yhkim');
    expect(MEMBER_ROUTE_SLUG.B).toBe('wschoi');
    expect(MEMBER_ROUTE_SLUG.C).toBe('hwshin');
    expect(APP_ROUTE_ADMIN).toBe('admin');
  });
});
