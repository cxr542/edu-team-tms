import { describe, expect, it } from 'vitest';
import { canAccessTeamModule } from '../src/hooks/useTeamAccess.js';
import { resolveAppModuleId } from '../src/utils/appRoute.js';
import { NAV_GROUP_DEFAULT_ORDER } from '../src/utils/navOrder.js';
import { listAutomationRoutines } from '../src/constants/automationRoutines.js';

describe('automation module', () => {
  it('is routable and admin-only', () => {
    expect(resolveAppModuleId('automation')).toBe('automation');
    expect(canAccessTeamModule({ isAdmin: true, isMemberScope: false }, 'automation')).toBe(true);
    expect(
      canAccessTeamModule({ isAdmin: false, isMemberScope: true, scopedMember: 'B' }, 'automation'),
    ).toBe(false);
    expect(canAccessTeamModule({ isAdmin: false, isMemberScope: false }, 'automation')).toBe(false);
  });

  it('sits in the leader nav group', () => {
    expect(NAV_GROUP_DEFAULT_ORDER.leader).toContain('automation');
  });

  it('has unique routines; demo ones have a preview; live ones are read-only or previewable+undoable', () => {
    const list = listAutomationRoutines();
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    list.filter((r) => !r.live && !r.readOnly && !r.link).forEach((r) => expect(r.preview?.length).toBeGreaterThan(0));
    // 바로가기 카드는 이 PC 로컬 주소만, 실행 없이 연다
    list
      .filter((r) => r.link)
      .forEach((r) => {
        expect(r.where).toBe('pc');
        expect(r.link.href).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
        expect(r.live || r.readOnly || r.preview).toBeFalsy();
      });
    list.filter((r) => r.live).forEach((r) => expect(r.readOnly === true || r.undoable === true).toBe(true));
  });
});
