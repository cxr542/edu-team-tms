import { describe, expect, it } from 'vitest';
import { WEEK_COLUMN_TEMPLATE } from '../src/constants/journalCategories.js';
import {
  buildWeekColumnTemplateFromCategories,
  normalizeMemberPrefs,
  resolveMemberCategories,
  resolveMemberWeekColumnTemplate,
} from '../src/utils/journalMemberPrefs.js';

describe('journalMemberPrefs', () => {
  it('keeps defaults when prefs missing', () => {
    const { cats, order } = resolveMemberCategories(null);
    expect(order).toEqual(['edu', 'prep', 'ai', 'other']);
    expect(cats.edu.label).toBe('교육');
    expect(resolveMemberWeekColumnTemplate(null)).toBe(WEEK_COLUMN_TEMPLATE);
  });

  it('applies member label and order overrides', () => {
    const prefs = normalizeMemberPrefs({
      categoryOrder: ['ai', 'edu', 'prep', 'other'],
      categories: { edu: { label: '강의', color: '#111111' } },
    });
    const { cats, order } = resolveMemberCategories(prefs);
    expect(order[0]).toBe('ai');
    expect(cats.edu.label).toBe('강의');
    expect(cats.edu.color).toBe('#111111');
  });

  it('builds week column template from legend labels', () => {
    const { cats, order } = resolveMemberCategories({
      categories: { edu: { label: '강의' }, prep: { label: '준비' } },
    });
    const text = buildWeekColumnTemplateFromCategories(cats, order);
    expect(text).toContain('• 강의');
    expect(text).toContain('• 준비');
  });
});
