import { describe, expect, it } from 'vitest';
import {
  buildCopyPatch,
  findPreviousSelfSource,
  hasSelfLevelInput,
  shiftMonth,
} from '../src/utils/competencyCopyPrevious';
import { mergeCompetencyEvalSidePatch, normalizeCompetencyEvalSide } from '../src/utils/competencyScore';

const rec = (intLevel, extra = {}) => ({ self: { intLevel, dims: {}, ...extra } });
const lookup = (table) => (y, m) => table[`${y}-${m}`];

describe('competencyCopyPrevious', () => {
  it('shiftMonth wraps across years', () => {
    expect(shiftMonth(2026, 0, 1)).toEqual({ year: 2025, monthIndex: 11 });
    expect(shiftMonth(2026, 5, 6)).toEqual({ year: 2025, monthIndex: 11 });
  });

  it('uses the previous month when present', () => {
    const src = findPreviousSelfSource(lookup({ '2026-7': rec(3), '2026-5': rec(2) }), 2026, 8);
    expect(src.monthIndex).toBe(7);
  });

  it('January falls back to previous December', () => {
    const src = findPreviousSelfSource(lookup({ '2025-11': rec(3) }), 2026, 0);
    expect(src).toMatchObject({ year: 2025, monthIndex: 11 });
  });

  it('falls back to the most recent earlier record', () => {
    const src = findPreviousSelfSource(lookup({ '2026-5': rec(2), '2026-3': rec(1) }), 2026, 8);
    expect(src.monthIndex).toBe(5);
  });

  it('returns null when no record exists', () => {
    expect(findPreviousSelfSource(lookup({}), 2026, 8)).toBeNull();
    expect(findPreviousSelfSource(lookup({ '2026-7': rec(0) }), 2026, 8)).toBeNull();
  });

  it('detects existing input (ignores free-text evidence)', () => {
    expect(hasSelfLevelInput(null)).toBe(false);
    expect(hasSelfLevelInput({ intLevel: 0, dims: {}, evidence: 'memo' })).toBe(false);
    expect(hasSelfLevelInput({ intLevel: 3 })).toBe(true);
    expect(hasSelfLevelInput({ intLevel: 0, dimLinks: { scope: 'https://a' } })).toBe(true);
  });

  it('copies only matching dim IDs and never the evidence memo', () => {
    const source = {
      intLevel: 3,
      evidence: 'memo',
      dims: { autonomy: 'met', scope: 'met', legacy: 'met' },
      dimEvidences: { autonomy: 'a', legacy: 'x' },
      dimLinks: { scope: 'https://s' },
    };
    const patch = buildCopyPatch(source, ['autonomy', 'scope']);
    expect(patch).toEqual({
      intLevel: 3,
      dims: { autonomy: 'met', scope: 'met' },
      dimEvidences: { autonomy: 'a' },
      dimLinks: { scope: 'https://s' },
    });
    expect(patch.evidence).toBeUndefined();
  });

  it('proposed level recomputes right after applying the patch', () => {
    const source = normalizeCompetencyEvalSide(
      { intLevel: 3, dims: { autonomy: 'met', scope: 'met', collaboration: 'met', quality: 'met' } },
      'default'
    );
    const merged = mergeCompetencyEvalSidePatch({}, buildCopyPatch(source), 'default');
    const after = normalizeCompetencyEvalSide(merged, 'default');
    expect(after.computed.proposed).toBe(source.computed.proposed);
    expect(after.computed.proposed).toBeGreaterThan(3);
  });
});
