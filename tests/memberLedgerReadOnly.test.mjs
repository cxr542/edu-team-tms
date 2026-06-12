import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('member ledger read-only enforcement', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
  const moduleSource = readFileSync(path.join(process.cwd(), 'src/hooks/useAppModule.js'), 'utf8');

  it('derives member ledger scope and edit guards from ledgerAccess helpers', () => {
    expect(appSource).toContain("from './utils/ledgerAccess'");
    expect(appSource).toContain('isMemberLedgerScope({ module, isMemberScope: teamAccess.isMemberScope })');
    expect(appSource).toContain('const ledgerReadOnly = isLedgerReadOnly({');
    expect(appSource).toContain('const canEditLedgerNow = canEditLedger({');
    expect(appSource).toContain('enabled: canEditLedgerNow');
  });

  it('shows member ledger read-only guidance copy', () => {
    expect(appSource).toContain('구성원 장부는 조회 전용입니다. 거래 추가·수정·삭제는 팀장 화면에서만 가능합니다.');
    expect(appSource).toContain('?mode=view&amp;module=ledger&amp;member=');
  });

  it('hides ledger write controls behind canEditLedgerNow', () => {
    expect(appSource).toContain('{canEditLedgerNow && (');
    expect(appSource).toContain('{canEditLedgerNow && filteredTransactions.length > 0 && (');
    expect(appSource).toContain('ledger-fab-stack');
    expect(appSource).not.toContain('{!ledgerReadOnly && filteredTransactions.length > 0 && (');
  });

  it('keeps member journal edit provider writable', () => {
    expect(appSource).toContain('{displayModule === \'journal\' && <WeeklyJournalPage readOnly={false} />}');
    expect(appSource).toContain('autoSyncCloud={false}');
  });

  it('builds official member ledger links with mode=view', () => {
    expect(moduleSource).toContain('resolveMemberLedgerViewMode');
    expect(moduleSource).toContain("url.searchParams.set('mode', 'view')");
  });

  it('preserves member ledger scroll UX and viewer collapse policy', () => {
    expect(appSource).toContain('ledgerDetailsCollapsible = isViewer && !teamAccess.isMemberScope');
    expect(appSource).toContain('showLedgerDetails = !ledgerDetailsCollapsible || viewerDetailsOpen');
  });
});
