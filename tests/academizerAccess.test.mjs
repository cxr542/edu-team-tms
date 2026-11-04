import { describe, expect, it } from 'vitest';
import { canAccessTeamModule } from '../src/hooks/useTeamAccess.js';
import { isExperimentalModule, isTeamCommonModule } from '../src/constants/teamAccess.js';
import { NAV_GROUP_DEFAULT_ORDER } from '../src/utils/navOrder.js';

describe('academizer module access', () => {
  it('is a team-common module, not an experimental one', () => {
    expect(isTeamCommonModule('academizer')).toBe(true);
    expect(isExperimentalModule('academizer')).toBe(false);
    expect(isExperimentalModule('cloud-chatbot')).toBe(true);
  });

  it('is available to the admin and to every member scope', () => {
    expect(canAccessTeamModule({ isAdmin: true, isMemberScope: false }, 'academizer')).toBe(true);
    ['A', 'B', 'C'].forEach((member) => {
      expect(
        canAccessTeamModule(
          { isAdmin: false, isMemberScope: true, scopedMember: member },
          'academizer',
        ),
      ).toBe(true);
    });
  });

  it('stays in the admin sidebar under common, not experimental', () => {
    expect(NAV_GROUP_DEFAULT_ORDER.common).toContain('academizer');
    expect(NAV_GROUP_DEFAULT_ORDER.experimental).not.toContain('academizer');
  });

  it('keeps cloud-chatbot admin-only', () => {
    expect(
      canAccessTeamModule({ isAdmin: false, isMemberScope: true, scopedMember: 'A' }, 'cloud-chatbot'),
    ).toBe(false);
  });
});
