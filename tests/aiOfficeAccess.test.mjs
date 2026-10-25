import { describe, expect, it } from 'vitest';
import { canAccessTeamModule } from '../src/hooks/useTeamAccess.js';

describe('ai-office module access', () => {
  it('is available to the admin only', () => {
    expect(canAccessTeamModule({ isAdmin: true, isMemberScope: false }, 'ai-office')).toBe(true);
    expect(
      canAccessTeamModule({ isAdmin: false, isMemberScope: true, scopedMember: 'B' }, 'ai-office'),
    ).toBe(false);
    expect(canAccessTeamModule({ isAdmin: false, isMemberScope: false }, 'ai-office')).toBe(false);
  });
});
