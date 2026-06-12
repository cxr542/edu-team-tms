import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('member ledger scroll layout', () => {
  it('shows ledger details without collapse for member scope', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(source).toContain('ledgerDetailsCollapsible = isViewer && !teamAccess.isMemberScope');
    expect(source).toContain('showLedgerDetails = !ledgerDetailsCollapsible || viewerDetailsOpen');
    expect(source).toContain('(!ledgerReadOnly || showLedgerDetails)');
    expect(source).toContain('ledgerDetailsCollapsible &&');
    expect(source).not.toMatch(/ledgerReadOnly && \(\s*\n\s*<button[\s\S]*?상세보기/);
  });

  it('marks readonly ledger main content for scroll styling', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(source).toContain("main-content--ledger-readonly");
    const css = readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toContain('.main-content--ledger-readonly');
  });

  it('keeps publish/download and polling policies unchanged', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    const publishHandler = source.slice(
      source.indexOf('const handlePublishForTeam'),
      source.indexOf('const handleDownloadLedgerBackup')
    );
    expect(source).toMatch(/pollMs:\s*0/);
    expect(source).toContain('autoSyncCloud={false}');
    expect(source).toContain('handleDownloadLedgerBackup');
    expect(publishHandler).not.toContain('downloadTeamSnapshot');
  });
});
