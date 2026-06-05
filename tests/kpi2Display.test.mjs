import { describe, expect, it } from 'vitest';
import { resolveKpi2Display } from '../src/utils/kpi2Display.js';

describe('resolveKpi2Display', () => {
  it('prefers official over preview', () => {
    const r = resolveKpi2Display({ productivityPct: 90 }, { productivityPct: 110 });
    expect(r.displayPct).toBe(90);
    expect(r.usesPreview).toBe(false);
  });

  it('falls back to preview when official is null', () => {
    const r = resolveKpi2Display({ productivityPct: null }, { productivityPct: 105 });
    expect(r.displayPct).toBe(105);
    expect(r.usesPreview).toBe(true);
  });
});
