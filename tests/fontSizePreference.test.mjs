import { describe, expect, it } from 'vitest';
import { FONT_SIZE_OPTIONS, getFontSizeOption } from '../src/constants/fontSizePreference.js';

describe('fontSizePreference', () => {
  it('has four presets', () => {
    expect(FONT_SIZE_OPTIONS).toHaveLength(4);
    expect(FONT_SIZE_OPTIONS.map((o) => o.id)).toEqual(['small', 'medium', 'large', 'xlarge']);
  });

  it('falls back to medium for unknown id', () => {
    expect(getFontSizeOption('invalid').id).toBe('medium');
    expect(getFontSizeOption('large').scale).toBeGreaterThan(1);
    expect(getFontSizeOption('small').scale).toBeLessThan(1);
  });
});
