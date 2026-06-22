import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('competency member lock controls', () => {
  const memberSectionSource = readFileSync(path.join(process.cwd(), 'src/components/CompetencyMemberSection.jsx'), 'utf8');
  const rubricPanelSource = readFileSync(path.join(process.cwd(), 'src/components/CompetencyRubricPanel.jsx'), 'utf8');

  it('does not expose manager unlock from the member monthly self-evaluation page', () => {
    expect(memberSectionSource).not.toContain('onUnlockManager');
    expect(rubricPanelSource).not.toContain('competency-manager-unlock-btn');
    expect(rubricPanelSource).toContain('수정이 필요하면 팀장에게 문의하세요.');
  });
});
