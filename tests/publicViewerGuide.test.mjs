import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPublicViewerScope } from '../src/utils/ledgerAccess.js';
import { PUBLIC_VIEWER_ROLE_PORTALS } from '../src/constants/publicViewerPortal.js';

describe('public viewer scope policy', () => {
  it('treats member-less view mode as public viewer landing', () => {
    expect(isPublicViewerScope({ isViewer: true, isMemberScope: false })).toBe(true);
    expect(isPublicViewerScope({ isViewer: true, isMemberScope: true })).toBe(false);
    expect(isPublicViewerScope({ isViewer: false, isMemberScope: false })).toBe(false);
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

  it('derives isPublicViewer from ledgerAccess and short-circuits module UI', () => {
    expect(appSource).toContain('isPublicViewerScope');
    expect(appSource).toContain('const isPublicViewer = isPublicViewerScope({');
    expect(appSource).toContain('{isPublicViewer ? (');
    expect(appSource).toContain('<PublicViewerGuidePage />');
    expect(appSource).toContain(
      'const ledgerSnapshotEnabled = !isPublicViewer && provisionalDisplayModule === \'ledger\''
    );
  });

  it('shows role portal cards without ledger fetch on public viewer', () => {
    expect(guideSource).toContain('교육팀 TMS 접속 안내');
    expect(guideSource).toContain('PUBLIC_VIEWER_ROLE_PORTALS');
    expect(guideSource).toContain('전체 북마크 URL 목록 보기');
    expect(accessSource).toContain('if (isPublicViewerScope({ isViewer, isMemberScope })) return false');
  });

  it('defines leader and member entry links including member ledger view mode', () => {
    const memberB = PUBLIC_VIEWER_ROLE_PORTALS.find((p) => p.id === 'member-b');
    const ledgerLink = memberB.links.find((l) => l.label === '장부 조회');
    expect(ledgerLink.mode).toBe('view');
    expect(ledgerLink.member).toBe('B');
    expect(PUBLIC_VIEWER_ROLE_PORTALS[0].primary.access).toBeTruthy();
  });

  it('hides viewer nav and sidebar on public viewer scope', () => {
    expect(shellSource).toContain('isPublicViewerScope');
    expect(shellSource).toContain('!isPublicViewerScope && (');
    expect(shellSource).toContain('canEditNav && !isPublicViewerScope');
    expect(shellSource).toContain('is-public-viewer-guide');
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
