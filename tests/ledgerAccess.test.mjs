import { describe, expect, it } from 'vitest';
import {
  canEditLedger,
  isLedgerReadOnly,
  isMemberLedgerScope,
  resolveMemberLedgerViewMode,
  usesPublishedLedgerData,
} from '../src/utils/ledgerAccess.js';
import { URL_ACCESS_ADMIN, URL_ACCESS_LEADER } from '../src/constants/teamAccess.js';

describe('ledgerAccess policy', () => {
  it('treats member ledger as read-only regardless of mode', () => {
    expect(
      isLedgerReadOnly({ isViewer: false, module: 'ledger', isMemberScope: true })
    ).toBe(true);
    expect(
      isLedgerReadOnly({ isViewer: true, module: 'ledger', isMemberScope: true })
    ).toBe(true);
    expect(isMemberLedgerScope({ module: 'ledger', isMemberScope: true })).toBe(true);
    expect(isMemberLedgerScope({ module: 'journal', isMemberScope: true })).toBe(false);
  });

  it('allows admin ledger edit with access=admin or legacy access=leader', () => {
    expect(
      canEditLedger({
        isViewer: false,
        module: 'ledger',
        isMemberScope: false,
        isAdmin: true,
        accessParam: URL_ACCESS_ADMIN,
      })
    ).toBe(true);
    expect(
      canEditLedger({
        isViewer: false,
        module: 'ledger',
        isMemberScope: false,
        isLeader: true,
        accessParam: URL_ACCESS_LEADER,
      })
    ).toBe(true);
    expect(
      canEditLedger({
        isViewer: false,
        module: 'ledger',
        isMemberScope: false,
        isAdmin: true,
        accessParam: null,
      })
    ).toBe(true);
  });

  it('blocks member ledger and public view edits', () => {
    expect(
      canEditLedger({
        isViewer: false,
        module: 'ledger',
        isMemberScope: true,
        isLeader: false,
        accessParam: null,
      })
    ).toBe(false);
    expect(
      canEditLedger({
        isViewer: true,
        module: 'ledger',
        isMemberScope: false,
        isLeader: true,
        accessParam: URL_ACCESS_LEADER,
      })
    ).toBe(false);
  });

  it('keeps member scope on published ledger data even on journal module', () => {
    expect(usesPublishedLedgerData({ isViewer: false, isMemberScope: true })).toBe(true);
    expect(usesPublishedLedgerData({ isViewer: false, isMemberScope: false })).toBe(false);
    expect(usesPublishedLedgerData({ isViewer: true, isMemberScope: false })).toBe(false);
    expect(usesPublishedLedgerData({ isViewer: true, isMemberScope: true })).toBe(true);
  });

  it('uses mode=view for official member ledger URLs', () => {
    expect(
      resolveMemberLedgerViewMode({ module: 'ledger', member: 'B', access: null })
    ).toBe('view');
    expect(
      resolveMemberLedgerViewMode({ module: 'ledger', member: 'B', access: URL_ACCESS_ADMIN })
    ).toBe(null);
    expect(resolveMemberLedgerViewMode({ module: 'journal', member: 'B', access: null })).toBe(null);
  });
});
