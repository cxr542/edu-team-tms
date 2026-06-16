import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPublicViewerScope } from '../src/utils/ledgerAccess.js';
import {
  PUBLIC_VIEWER_ADMIN_PORTAL,
  PUBLIC_VIEWER_USER_PORTALS,
} from '../src/constants/publicViewerPortal.js';
import { getTeamAccessFromSearchParams } from '../src/hooks/useTeamAccess.js';

describe('public viewer scope policy', () => {
  it('treats member-less view mode as public viewer landing', () => {
    expect(isPublicViewerScope({ isViewer: true, isMemberScope: false })).toBe(true);
    expect(isPublicViewerScope({ isViewer: true, isMemberScope: true })).toBe(false);
    expect(isPublicViewerScope({ isViewer: false, isMemberScope: false })).toBe(false);
  });

  it('treats `/` path as public landing even in dev edit mode', () => {
    expect(
      isPublicViewerScope({
        isViewer: false,
        isMemberScope: false,
        location: { pathname: '/', search: '' },
      })
    ).toBe(true);
  });
});

describe('public landing team access', () => {
  it('does not treat root `/` as admin scope', () => {
    const access = getTeamAccessFromSearchParams(new URLSearchParams(''), {
      pathname: '/',
      search: '',
    });
    expect(access.isAdmin).toBe(false);
    expect(access.isMemberScope).toBe(false);
  });
});

describe('public viewer landing UI', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  const shellSource = readFileSync(path.join(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');
  const guideSource = readFileSync(
    path.join(process.cwd(), 'src/pages/PublicViewerGuidePage.jsx'),
    'utf8'
  );
  const accessSource = readFileSync(path.join(process.cwd(), 'src/utils/ledgerAccess.js'), 'utf8');

  it('derives isPublicViewer from route scope and short-circuits module UI', () => {
    expect(appSource).toContain("appRoute.scope === 'public'");
    expect(appSource).toContain('{isPublicViewer ? (');
    expect(appSource).toContain('<PublicViewerGuidePage />');
    expect(appSource).toContain(
      "const ledgerSnapshotEnabled = !isPublicViewer && provisionalDisplayModule === 'ledger'"
    );
  });

  it('shows user portal cards first and admin section separately', () => {
    expect(guideSource).toContain('업무 화면으로');
    expect(guideSource).toContain('PUBLIC_VIEWER_USER_PORTALS');
    expect(guideSource).toContain('PUBLIC_VIEWER_ADMIN_PORTAL');
    expect(guideSource).toContain('public-viewer-portal__section');
    expect(guideSource).toContain('public-viewer-portal__grid--users');
    expect(guideSource).toContain('전체 북마크 URL 목록 (관리자)');
    expect(accessSource).toContain("parseAppRoute(location).scope === 'public'");
  });

  it('defines admin href and user entry links including member ledger view mode', () => {
    expect(PUBLIC_VIEWER_ADMIN_PORTAL.primary.href).toContain('/admin');
    const memberA = PUBLIC_VIEWER_USER_PORTALS.find((p) => p.id === 'user-a');
    const memberB = PUBLIC_VIEWER_USER_PORTALS.find((p) => p.id === 'user-b');
    expect(memberA.badge).toBe('A');
    expect(memberA.primary.member).toBe('A');
    const ledgerLink = memberB.links.find((l) => l.label === '장부 조회');
    expect(ledgerLink.mode).toBe('view');
    expect(ledgerLink.member).toBe('B');
  });

  it('gates /admin behind password screen', () => {
    expect(appSource).toContain('needsAdminGate');
    expect(appSource).toContain('<AdminGatePage');
    expect(appSource).toContain('isAdminGateUnlocked');
  });

  it('hides viewer nav and sidebar on public viewer scope', () => {
    expect(shellSource).toContain('isPublicViewerScope');
    expect(shellSource).toContain('!isPublicViewerScope && (');
    expect(shellSource).toContain('canEditNav && isAdminShell && !isPublicViewerScope');
    expect(shellSource).toContain('is-public-viewer-guide');
  });

  it('links admin shell sidebar to public landing', () => {
    expect(shellSource).toContain('isAdminShell &&');
    expect(shellSource).toContain('project-nav-item--hub');
    expect(shellSource).toContain("href={withAppBase('/')}");
    expect(shellSource).toContain('접속 안내');
  });

  it('keeps member ledger view and leader edit routes outside public viewer branch', () => {
    expect(appSource).toContain('ledgerReadOnly = isLedgerReadOnly({');
    expect(appSource).toContain('canEditLedgerNow');
    expect(appSource).toContain("{displayModule === 'journal' && <WeeklyJournalPage readOnly={false} />}");
  });

  it('skips viewer module redirect on public viewer landing', () => {
    expect(appSource).toContain('if (!isViewer || isPublicViewer) return;');
  });
});
