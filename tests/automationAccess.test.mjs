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

  it('has unique routines; mutating ones have a preview; only read-only ones are live', () => {
    const list = listAutomationRoutines();
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    list.filter((r) => !r.readOnly).forEach((r) => expect(r.preview?.length).toBeGreaterThan(0));
    list.filter((r) => r.live).forEach((r) => expect(r.readOnly).toBe(true));
  });
});
