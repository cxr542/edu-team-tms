import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('competency member lock controls', () => {
  const memberSectionSource = readFileSync(path.join(process.cwd(), 'src/components/CompetencyMemberSection.jsx'), 'utf8');
  const rubricPanelSource = readFileSync(path.join(process.cwd(), 'src/components/CompetencyRubricPanel.jsx'), 'utf8');

  it('manager unlock is exposed from CompetencyRubricPanel, but not directly used by MemberSection', () => {
    // CompetencyMemberSection doesn't use onUnlockManager, it uses onUnlockSelf
    expect(memberSectionSource).not.toContain('onUnlockManager');
    // CompetencyRubricPanel exposes the UI for the manager to unlock
    expect(rubricPanelSource).toContain('competency-manager-unlock-btn');
  });
});
