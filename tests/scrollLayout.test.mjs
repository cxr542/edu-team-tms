import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('single document scroll layout', () => {
  it('uses html as the only vertical scroll root', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    expect(css).toMatch(/html\s*\{[\s\S]*overflow-y:\s*auto/);
    expect(css).toMatch(/body\s*\{[\s\S]*overflow:\s*visible/);
    expect(css).toMatch(/\.main-content\s*\{[\s\S]*overflow:\s*visible/);
  });

  it('avoids overflow-x hidden paired with overflow-y visible (computes to auto)', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    const bodyBlock = css.match(/body\s*\{[\s\S]*?\}/)?.[0] ?? '';
    const mainBlock = css.match(/\.main-content\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(bodyBlock).not.toMatch(/overflow-x:\s*hidden[\s\S]*overflow-y:\s*visible/);
    expect(mainBlock).not.toMatch(/overflow-x:\s*hidden[\s\S]*overflow-y:\s*visible/);
  });

  it('keeps journal and KPI pages on document scroll', () => {
    const journalCss = readFileSync(
      path.join(process.cwd(), 'src/pages/WeeklyJournalPage.css'),
      'utf8'
    );
    const kpiCss = readFileSync(path.join(process.cwd(), 'src/pages/TeamKpiPage.css'), 'utf8');
    expect(journalCss).toMatch(/\.journal-main[\s\S]*overflow-y:\s*visible/);
    expect(kpiCss).toMatch(/\.team-kpi-main[\s\S]*overflow-y:\s*visible/);
  });

  it('places sidebar collapse control in the header beside the logo', () => {
    const shellCss = readFileSync(
      path.join(process.cwd(), 'src/styles/projectShell.css'),
      'utf8'
    );
    const source = readFileSync(path.join(process.cwd(), 'src/components/AppShell.jsx'), 'utf8');
    const railBlock = shellCss.match(/\.project-sidebar-rail\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(railBlock).not.toMatch(/position:\s*fixed/);
    expect(railBlock).not.toMatch(/writing-mode:\s*vertical/);
    expect(source).toMatch(/project-sidebar__head[\s\S]*project-sidebar-rail/);
    expect(shellCss).toMatch(/\.project-sidebar\s*\{[\s\S]*align-self:\s*start/);
  });

  it('ledger toolbar pin listens to window scroll only', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
    const block = source.slice(
      source.indexOf('if (ledgerReadOnly) return undefined;'),
      source.indexOf('ledgerReadOnly,\n    updateLedgerToolbarPin')
    );
    expect(block).toContain("window.addEventListener('scroll', onScroll");
    expect(block).not.toContain("main?.addEventListener('scroll'");
  });
});
