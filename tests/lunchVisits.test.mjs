import { describe, expect, it } from 'vitest';
import {
  buildWeekView,
  kstTodayKey,
  mergeVisitHistory,
  topVisitedSpots,
  visitsFromLegacyHistory,
} from '../src/utils/lunchVisits.js';

const v = (day, spotId, spotName = spotId) => ({ day, spotId, spotName });

describe('buildWeekView', () => {
  it('목요일이면 그 주 월~금, 오늘·미래 표시', () => {
    const week = buildWeekView('2026-11-26', [v('2026-11-23', 'a', '순대국'), v('2026-11-26', 'b')]);
    expect(week.map((d) => d.key)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
    expect(week[0].visit.spotName).toBe('순대국');
    expect(week[3].isToday).toBe(true);
    expect(week[4].isFuture).toBe(true);
    expect(week[1].visit).toBeNull();
  });

  it('일요일이면 지나간 주를 보여준다', () => {
    const week = buildWeekView('2026-11-29', []);
    expect(week[0].key).toBe('2026-11-23');
    expect(week.every((d) => !d.isFuture)).toBe(true);
  });
});

describe('topVisitedSpots', () => {
  it('횟수 순, 같으면 최근 순, 최신 이름', () => {
    const top = topVisitedSpots([
      v('2026-11-20', 'a', '옛 이름'),
      v('2026-11-25', 'a', '새 이름'),
      v('2026-11-24', 'b'),
      v('2026-11-21', 'c'),
      v('2026-11-26', 'd'),
    ]);
    expect(top.map((t) => [t.spotId, t.count])).toEqual([['a', 2], ['d', 1], ['b', 1]]);
    expect(top[0].spotName).toBe('새 이름');
  });
});

describe('mergeVisitHistory', () => {
  it('더 최근 값을 남긴다', () => {
    const merged = mergeVisitHistory([v('2026-11-25', 'a'), v('2026-11-01', 'b')], {
      a: '2026-11-02T00:00:00.000Z',
      b: '2026-11-20T00:00:00.000Z',
    });
    expect(merged.a).toBe('2026-11-25T03:00:00.000Z');
    expect(merged.b).toBe('2026-11-20T00:00:00.000Z');
  });
});

describe('visitsFromLegacyHistory', () => {
  it('하루 한 곳(그날 마지막), KST 날짜, 최근 순', () => {
    const out = visitsFromLegacyHistory(
      {
        a: '2026-11-25T03:00:00.000Z',
        b: '2026-11-25T05:00:00.000Z',
        c: '2026-11-25T16:00:00.000Z', // KST 11-26 01시
        bad: 'nope',
      },
      (id) => ({ name: id.toUpperCase(), category: '한식' })
    );
    expect(out).toEqual([
      { day: '2026-11-26', spotId: 'c', spotName: 'C', category: '한식' },
      { day: '2026-11-25', spotId: 'b', spotName: 'B', category: '한식' },
    ]);
  });
});

describe('kstTodayKey', () => {
  it('KST 자정 경계', () => {
    expect(kstTodayKey(new Date('2026-11-25T15:00:00.000Z'))).toBe('2026-11-26');
  });
});
