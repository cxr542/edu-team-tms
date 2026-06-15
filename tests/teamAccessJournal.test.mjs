import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canEditMemberJournal, getTeamAccessFromSearchParams } from '../src/hooks/useTeamAccess.js';
import { isTeamCommonModule } from '../src/constants/teamAccess.js';

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

  it('reference docs is a team-common module for members', () => {
    expect(isTeamCommonModule('docs')).toBe(true);
    const access = getTeamAccessFromSearchParams(new URLSearchParams('member=B&module=docs'));
    expect(access.isMemberScope).toBe(true);
  });
});

describe('AppShell member docs nav', () => {
  const shellSource = readFileSync(path.join(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');

  it('shows reference docs footer nav for team-common (member) scope', () => {
    expect(shellSource).toContain('showTeamCommonNav || isViewer');
    expect(shellSource).toContain("canShowEditModule('docs')");
  });
});
