import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AppShell sidebar Safari safety', () => {
  const appShellSource = readFileSync(
    path.join(process.cwd(), 'src/components/AppShell.jsx'),
    'utf8'
  );
  const indexCss = readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');

  it('does not combine legacy .sidebar hide class with live project-sidebar', () => {
    expect(appShellSource).toContain('className="project-sidebar"');
    expect(appShellSource).not.toContain('className="sidebar project-sidebar"');
    expect(indexCss).toContain('.sidebar:not(.project-sidebar)');
  });
});
