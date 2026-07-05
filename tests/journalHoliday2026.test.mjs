import { describe, expect, it } from 'vitest';
import { applyLeavePresetToDay } from '../src/utils/journalLeavePresets.js';
import {
  apply2026PublicHolidaysToDays,
  resolveJournalDay,
} from '../src/utils/journalHoliday2026.js';
import { normalizeJournalSnapshot } from '../src/utils/journalSnapshot.js';

describe('journal 2026 public holidays', () => {
  it('preserves an explicit cleared public-holiday override when rendering and normalizing', () => {
    const publicHoliday = {
      holiday: true,
      mm: { work: 0, improve: 0, leave: 0.8125 },
      tasks: [],
    };
    const cleared = applyLeavePresetToDay(publicHoliday, 'clear', { publicHoliday: true });

    expect(cleared.publicHolidayOverride).toBe(true);
    expect(resolveJournalDay('2026-06-03', cleared).mm.leave).toBe(0);

    const snapshot = normalizeJournalSnapshot({
      memberJournals: {
        A: {
          days: {
            '2026-06-03': cleared,
          },
        },
      },
    });

    expect(snapshot.memberJournals.A.days['2026-06-03'].holiday).toBe(false);
    expect(snapshot.memberJournals.A.days['2026-06-03'].mm.leave).toBe(0);
    expect(snapshot.memberJournals.A.days['2026-06-03'].publicHolidayOverride).toBe(true);
  });

  it('keeps auto-applying 2026 public holidays for unmarked legacy rows', () => {
    const days = apply2026PublicHolidaysToDays({
      '2026-06-03': {
        holiday: false,
        mm: { work: 0.25, improve: 0, leave: 0 },
        tasks: [{ id: 'legacy', cat: 'other', title: 'legacy work', actual: 2, done: true }],
      },
    });

    expect(days['2026-06-03'].holiday).toBe(true);
    expect(days['2026-06-03'].mm).toEqual({ work: 0, improve: 0, leave: 0.8125 });
    expect(resolveJournalDay('2026-06-03', days['2026-06-03']).holiday).toBe(true);
  });
});
