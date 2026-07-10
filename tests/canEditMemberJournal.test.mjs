import { describe, expect, it } from 'vitest';
import { canEditMemberJournal } from '../src/hooks/useTeamAccess.js';

describe('canEditMemberJournal', () => {
  it('blocks admin /admin journal body edits for all members', () => {
    const admin = {
      isAdmin: true,
      isMemberScope: false,
      memberLocked: false,
      scopedMember: null,
      leaderMemberCode: 'A',
    };
    expect(canEditMemberJournal(admin, 'A')).toBe(false);
    expect(canEditMemberJournal(admin, 'B')).toBe(false);
    expect(canEditMemberJournal(admin, 'C')).toBe(false);
  });

  it('allows member-scoped URLs to edit only their own journal', () => {
    const memberB = {
      isAdmin: false,
      isMemberScope: true,
      memberLocked: true,
      scopedMember: 'B',
      leaderMemberCode: 'A',
    };
    expect(canEditMemberJournal(memberB, 'B')).toBe(true);
    expect(canEditMemberJournal(memberB, 'A')).toBe(false);
    expect(canEditMemberJournal(memberB, 'C')).toBe(false);
  });
});
