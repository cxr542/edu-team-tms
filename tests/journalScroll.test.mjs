import { describe, expect, it } from 'vitest';
import { getWeeksInMonth } from '../src/utils/journalMm.js';
import {
  findWeekKeyForDayKey,
  resolveJournalScrollDayKey,
} from '../src/utils/journalScroll.js';

describe('journalScroll helpers', () => {
  it('finds week key for a weekday in the month grid', () => {
    const weeks = getWeeksInMonth(2026, 5);
    expect(findWeekKeyForDayKey(weeks, '2026-06-10')).toBe('w2');
    expect(findWeekKeyForDayKey(weeks, '2026-06-15')).toBe('w3');
  });

  it('returns null when day is outside weekday columns', () => {
    const weeks = getWeeksInMonth(2026, 5);
    expect(findWeekKeyForDayKey(weeks, '2026-06-14')).toBeNull();
  });

  it('maps weekend dates to Friday for scroll target', () => {
    expect(resolveJournalScrollDayKey('2026-06-13')).toBe('2026-06-12');
    expect(resolveJournalScrollDayKey('2026-06-14')).toBe('2026-06-12');
    expect(resolveJournalScrollDayKey('2026-06-10')).toBe('2026-06-10');
  });
});
