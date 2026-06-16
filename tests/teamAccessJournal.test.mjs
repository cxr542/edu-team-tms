import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canEditMemberJournal, getTeamAccessFromSearchParams } from '../src/hooks/useTeamAccess.js';
import { isAdminAccessParam, isTeamCommonModule, URL_ACCESS_ADMIN, URL_ACCESS_LEADER } from '../src/constants/teamAccess.js';

describe('canEditMemberJournal', () => {
  it('admin can edit any member journal', () => {
    const access = getTeamAccessFromSearchParams(new URLSearchParams('access=admin&member=B'));
    expect(canEditMemberJournal(access, 'A')).toBe(true);
    expect(canEditMemberJournal(access, 'C')).toBe(true);
  });

  it('legacy access=leader is treated as admin', () => {
    const access = getTeamAccessFromSearchParams(new URLSearchParams('access=leader&member=B'));
    expect(access.isAdmin).toBe(true);
    expect(canEditMemberJournal(access, 'A')).toBe(true);
  });

  it('member B can edit only own journal', () => {
    const access = getTeamAccessFromSearchParams(new URLSearchParams('member=B&module=journal'));
    expect(canEditMemberJournal(access, 'B')).toBe(true);
    expect(canEditMemberJournal(access, 'A')).toBe(false);
    expect(canEditMemberJournal(access, 'C')).toBe(false);
  });

  it('member A uses the same user scope as B/C', () => {
    const access = getTeamAccessFromSearchParams(new URLSearchParams('member=A&module=journal'));
    expect(access.isMemberScope).toBe(true);
    expect(access.isAdmin).toBe(false);
    expect(canEditMemberJournal(access, 'A')).toBe(true);
    expect(canEditMemberJournal(access, 'B')).toBe(false);
  });

  it('reference docs is a team-common module for members', () => {
    expect(isTeamCommonModule('docs')).toBe(true);
    const access = getTeamAccessFromSearchParams(new URLSearchParams('member=B&module=docs'));
    expect(access.isMemberScope).toBe(true);
  });

  it('recognizes admin access params', () => {
    expect(isAdminAccessParam(URL_ACCESS_ADMIN)).toBe(true);
    expect(isAdminAccessParam(URL_ACCESS_LEADER)).toBe(true);
    expect(isAdminAccessParam('member')).toBe(false);
  });
});

describe('AppShell member docs nav', () => {
  const shellSource = readFileSync(path.join(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');

  it('shows reference docs footer nav for team-common (member) scope', () => {
    expect(shellSource).toContain('showTeamCommonNav || isMemberShell || isViewer');
    expect(shellSource).toContain("canShowEditModule('docs')");
  });

  it('shows admin scope badge in toolbar', () => {
    expect(shellSource).toContain('관리자');
    expect(shellSource).toContain('teamAccess?.isAdmin');
  });

  it('limits leader and experimental nav to admin shell only', () => {
    expect(shellSource).toContain('const isAdminShell = Boolean(teamAccess?.isAdmin && !teamAccess?.isMemberScope)');
    expect(shellSource).toContain('const showLeaderNav = !isViewer && isAdminShell');
    expect(shellSource).toContain('const showExperimentalNav = !isViewer && isAdminShell');
    expect(shellSource).toContain('const showTeamCommonNav = !isViewer && isMemberShell');
    expect(shellSource).not.toMatch(/showLeaderNav = !isViewer && \(!teamAccess \|\| teamAccess\.isLeader\)/);
  });
});
