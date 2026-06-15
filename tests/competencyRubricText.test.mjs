import { describe, expect, it } from 'vitest';
import {
  mapMemberRoleToCompetency,
  orderedDimsForDisplay,
  resolveEffectiveCompetencyRoleId,
} from '../src/constants/competencyRubric.js';
import {
  rubricObserveText,
  rubricRowsForRole,
  rubricRowsOrderedForRole,
  ROLE_RUBRIC_ROWS,
} from '../src/constants/competencyRubricText.js';

describe('competency rubric by role', () => {
  it('maps team member roles to competency role ids', () => {
    expect(mapMemberRoleToCompetency('강사')).toBe('instructor');
    expect(mapMemberRoleToCompetency('겸업')).toBe('concurrent');
    expect(mapMemberRoleToCompetency('기획/운영')).toBe('planner');
  });

  it('resolveEffectiveCompetencyRoleId prefers member role when record is default', () => {
    expect(resolveEffectiveCompetencyRoleId('default', '겸업')).toBe('concurrent');
    expect(resolveEffectiveCompetencyRoleId(undefined, '강사')).toBe('instructor');
    expect(resolveEffectiveCompetencyRoleId('planner', '강사')).toBe('planner');
    expect(
      resolveEffectiveCompetencyRoleId('planner', '강사', { memberView: true })
    ).toBe('instructor');
  });

  it('instructor rubric rows follow accumulation order (전문성 first)', () => {
    const ordered = rubricRowsOrderedForRole('instructor');
    expect(ordered[0].id).toBe('expertise');
    expect(ordered[0].label).toBe('전문성·표준화');
    expect(orderedDimsForDisplay('instructor')[0].id).toBe('expertise');
  });

  it('rubricObserveText returns KPI doc phrase for instructor L3', () => {
    expect(rubricObserveText('instructor', 'expertise', 3)).toBe('가이드 개선 제안 가끔');
    expect(rubricObserveText('instructor', 'scope', 3)).toBe('일반 난이도 과정 담당');
  });

  it('instructor rubric matches KPI definition — 강사 역량 수준 기준표', () => {
    const instructor = rubricRowsForRole('instructor').find((r) => r.id === 'expertise');
    expect(instructor.levels[4]).toBe('강의 기준·프레임워크 설계');
    const scope = rubricRowsForRole('instructor').find((r) => r.id === 'scope');
    expect(scope.levels[0]).toBe('단순 보조 강의 위주');
  });

  it('planner rubric matches KPI definition — 기획/운영 역량 수준 기준표', () => {
    const planner = rubricRowsForRole('planner').find((r) => r.id === 'collaboration');
    expect(planner.levels[2]).toBe('강사·수강생 일상 조율 가능');
  });

  it('each role has five dimensions with five level texts', () => {
    for (const roleId of Object.keys(ROLE_RUBRIC_ROWS)) {
      const rows = rubricRowsForRole(roleId);
      expect(rows).toHaveLength(5);
      rows.forEach((row) => {
        expect(row.levels).toHaveLength(5);
        row.levels.forEach((text) => expect(String(text).length).toBeGreaterThan(4));
      });
    }
  });
});
