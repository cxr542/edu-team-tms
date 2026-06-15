import { describe, expect, it } from 'vitest';
import { canEditMemberJournal, getTeamAccessFromSearchParams } from '../src/hooks/useTeamAccess.js';

describe('canEditMemberJournal', () => {
  it('team leader can edit any member journal', () => {
    const access = getTeamAccessFromSearchParams(new URLSearchParams('access=leader&member=B'));
    expect(canEditMemberJournal(access, 'A')).toBe(true);
    expect(canEditMemberJournal(access, 'C')).toBe(true);
  });

  it('member B can edit only own journal', () => {
    const access = getTeamAccessFromSearchParams(new URLSearchParams('member=B&module=journal'));
    expect(canEditMemberJournal(access, 'B')).toBe(true);
    expect(canEditMemberJournal(access, 'A')).toBe(false);
    expect(canEditMemberJournal(access, 'C')).toBe(false);
  });
});
