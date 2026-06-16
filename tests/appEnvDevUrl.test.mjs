import { describe, expect, it, vi } from 'vitest';
import {
  canShowLeaderDevUrlLink,
  getDevelopmentAppUrl,
} from '../src/constants/appEnv.js';
import { URL_ACCESS_ADMIN, URL_ACCESS_LEADER } from '../src/constants/teamAccess.js';

describe('leader dev URL link', () => {
  it('builds localhost leader URL and preserves module context', () => {
    const href =
      'https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=kpi&year=2026&month=6&member=B';
    const url = new URL(getDevelopmentAppUrl(href));
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.searchParams.get('mode')).toBeNull();
    expect(url.searchParams.get('access')).toBeNull();
    expect(url.searchParams.get('module')).toBe('kpi');
    expect(url.searchParams.get('year')).toBe('2026');
    expect(url.searchParams.get('month')).toBe('6');
    expect(url.searchParams.get('member')).toBe('B');
  });

  it('uses current origin on local dev for preview', () => {
    vi.stubGlobal('window', {
      location: {
        href: 'http://127.0.0.1:3000/?mode=edit&access=leader&module=journal',
        origin: 'http://127.0.0.1:3000',
        hostname: '127.0.0.1',
        protocol: 'http:',
        pathname: '/',
      },
    });
    const url = new URL(getDevelopmentAppUrl());
    expect(url.origin).toBe('http://127.0.0.1:3000');
    expect(url.searchParams.get('module')).toBe('journal');
    vi.unstubAllGlobals();
  });

  it('shows dev link on leader edit in both prod and local dev', () => {
    const leader = { isLeader: true, isMemberScope: false };
    expect(
      canShowLeaderDevUrlLink({
        isViewer: false,
        isPublicViewerScope: false,
        teamAccess: leader,
      })
    ).toBe(true);

    expect(
      canShowLeaderDevUrlLink({
        teamAccess: { isLeader: true, isMemberScope: true, scopedMember: 'B' },
      })
    ).toBe(false);

    expect(
      canShowLeaderDevUrlLink({
        isViewer: true,
        teamAccess: leader,
      })
    ).toBe(false);

    expect(
      canShowLeaderDevUrlLink({
        isPublicViewerScope: true,
        teamAccess: leader,
      })
    ).toBe(false);
  });

  it('uses /admin path in generated dev URL', () => {
    const url = new URL(getDevelopmentAppUrl('https://example.com/?mode=edit'));
    expect(url.pathname).toBe('/admin');
    expect(url.searchParams.get('access')).toBeNull();
    expect(url.searchParams.get('mode')).toBeNull();
  });
});
