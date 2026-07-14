import { describe, expect, it } from 'vitest';
import {
  isAdminOrSameMemberRouteReferer,
  isAdminRouteReferer,
  memberCodeFromReferer,
} from '../server/api-utils/requestScope.js';

function req(referer) {
  return { headers: { referer } };
}

describe('requestScope API referer helpers', () => {
  it('recognizes current and legacy admin routes', () => {
    expect(isAdminRouteReferer(req('https://edu-team-tms-ten.vercel.app/admin?module=kpi'))).toBe(true);
    expect(isAdminRouteReferer(req('https://edu-team-tms-ten.vercel.app/?access=admin&module=kpi'))).toBe(true);
    expect(isAdminRouteReferer(req('https://edu-team-tms-ten.vercel.app/?access=leader&module=kpi'))).toBe(true);
  });

  it('does not let member path slugs become admin routes via query params', () => {
    expect(isAdminRouteReferer(req('https://edu-team-tms-ten.vercel.app/wschoi?access=admin'))).toBe(false);
    expect(memberCodeFromReferer(req('https://edu-team-tms-ten.vercel.app/wschoi?access=admin'))).toBe('B');
  });

  it('recognizes same-member scoped routes', () => {
    expect(isAdminOrSameMemberRouteReferer(req('https://edu-team-tms-ten.vercel.app/wschoi'), 'B')).toBe(true);
    expect(isAdminOrSameMemberRouteReferer(req('https://edu-team-tms-ten.vercel.app/wschoi'), 'C')).toBe(false);
    expect(isAdminOrSameMemberRouteReferer(req('https://edu-team-tms-ten.vercel.app/hyshin'), 'C')).toBe(true);
    expect(isAdminOrSameMemberRouteReferer(req('https://edu-team-tms-ten.vercel.app/hwshin'), 'C')).toBe(true);
    expect(isAdminOrSameMemberRouteReferer(req('https://edu-team-tms-ten.vercel.app/?member=C'), 'C')).toBe(true);
  });
});
