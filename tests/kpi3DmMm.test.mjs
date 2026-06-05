import { describe, expect, it } from 'vitest';
import { DM_DUAL_DEFAULT_LECTURE_PCT } from '../src/constants/kpi3DmProfile.js';
import {
  DM_WEIGHT_MODE_MANUAL,
  clampManualLecturePct,
  resolveDualDmWeights,
} from '../src/utils/kpi3DmMm.js';

describe('clampManualLecturePct', () => {
  it('clamps to 30-70 (ops-centered down to 70% ops)', () => {
    expect(clampManualLecturePct(80)).toBe(70);
    expect(clampManualLecturePct(25)).toBe(30);
    expect(clampManualLecturePct(40)).toBe(40);
  });

  it('defaults to ops-centered 40 when empty', () => {
    expect(clampManualLecturePct('')).toBe(DM_DUAL_DEFAULT_LECTURE_PCT);
  });
});

describe('resolveDualDmWeights', () => {
  const journal = {
    lectureWeight: 0.7,
    opsWeight: 0.3,
    lectureHours: 61.5,
    opsHours: 24,
    source: 'journal',
    rawLecturePct: 71.93,
  };

  it('uses journal weights by default', () => {
    const r = resolveDualDmWeights(journal, { weightMode: 'journal' });
    expect(r.source).toBe('journal');
    expect(r.lecturePct).toBe(70);
    expect(r.opsPct).toBe(30);
  });

  it('uses ops-centered default when journal empty', () => {
    const r = resolveDualDmWeights(null, { weightMode: 'journal' });
    expect(r.lecturePct).toBe(40);
    expect(r.opsPct).toBe(60);
  });

  it('uses manual override when set', () => {
    const r = resolveDualDmWeights(journal, {
      weightMode: DM_WEIGHT_MODE_MANUAL,
      manualLecturePct: '60',
    });
    expect(r.source).toBe(DM_WEIGHT_MODE_MANUAL);
    expect(r.lecturePct).toBe(60);
    expect(r.opsPct).toBe(40);
    expect(r.lectureWeight).toBe(0.6);
  });
});
