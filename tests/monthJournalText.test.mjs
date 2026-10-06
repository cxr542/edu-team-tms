import { describe, expect, it } from 'vitest';
import { buildMonthJournalText } from '../src/utils/monthJournalText.js';

const days = {
  '2026-07-01': { tasks: [{ cat: 'edu', title: ' K8s 강의 ', note: '3일차' }, { cat: 'prep', title: '  ' }] },
  '2026-07-02': { tasks: [] },
  '2026-07-03': { tasks: [{ cat: 'unknown', title: '회의', note: '' }] },
  '2026-08-01': { tasks: [{ cat: 'ai', title: '다른 달' }] },
};

describe('buildMonthJournalText', () => {
  it('reads the days map (not an array) and filters by month', () => {
    const text = buildMonthJournalText(days, 2026, 6);
    expect(text).toContain('[2026-07-01]');
    expect(text).not.toContain('다른 달');
  });

  it('uses cat labels and title/note fields', () => {
    const text = buildMonthJournalText(days, 2026, 6);
    expect(text).toContain('- 카테고리: 교육, 내용: K8s 강의 (3일차)');
    expect(text).toContain('- 카테고리: 기타, 내용: 회의');
  });

  it('skips empty days and returns empty string when nothing to summarize', () => {
    expect(buildMonthJournalText(days, 2026, 6)).not.toContain('2026-07-02');
    expect(buildMonthJournalText(days, 2026, 8)).toBe('');
    expect(buildMonthJournalText(null, 2026, 6)).toBe('');
  });
});

describe('buildMonthJournalText member categories', () => {
  it('uses the member legend labels when provided', () => {
    const text = buildMonthJournalText(
      { '2026-07-01': { tasks: [{ cat: 'edu', title: '강의' }] } },
      2026,
      6,
      { edu: { label: '내 교육' } }
    );
    expect(text).toContain('카테고리: 내 교육');
  });
});
