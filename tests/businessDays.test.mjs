import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  isBusinessDay,
  noticeDeadlineStatus,
  quarterEndKey,
  quarterNoticeDeadline,
} from '../src/utils/businessDays.js';

describe('businessDays — 확정 통보 마감 (분기 말 + 5영업일)', () => {
  it('isBusinessDay: 주말·공휴일 제외', () => {
    expect(isBusinessDay('2026-10-02')).toBe(true); // 금
    expect(isBusinessDay('2026-10-03')).toBe(false); // 토 (개천절)
    expect(isBusinessDay('2026-10-04')).toBe(false); // 일
    expect(isBusinessDay('2026-10-05')).toBe(false); // 개천절 대체공휴일
    expect(isBusinessDay('2026-10-09')).toBe(false); // 한글날
    expect(isBusinessDay('2026-10-06')).toBe(true);
  });

  it('quarterEndKey', () => {
    expect(quarterEndKey('2026-1Q')).toBe('2026-03-31');
    expect(quarterEndKey('2026-2Q')).toBe('2026-06-30');
    expect(quarterEndKey('2026-3Q')).toBe('2026-09-30');
    expect(quarterEndKey('2026-4Q')).toBe('2026-12-31');
    expect(quarterEndKey('bad')).toBeNull();
  });

  it('3Q 2026 → 2026-10-08 (10/3 토·10/5 대체공휴일 제외)', () => {
    const r = quarterNoticeDeadline('2026-3Q');
    expect(r.deadline).toBe('2026-10-08');
    expect(r.holidayDataComplete).toBe(true);
  });

  it('2Q 2026 → 2026-07-07', () => {
    expect(quarterNoticeDeadline('2026-2Q').deadline).toBe('2026-07-07');
  });

  it('4Q 2026은 2027년 공휴일 데이터가 없어 추정값으로 표시', () => {
    const r = quarterNoticeDeadline('2026-4Q');
    expect(r.deadline).toBe('2027-01-07'); // 신정(1/1)을 못 빼므로 실제보다 하루 이를 수 있음
    expect(r.holidayDataComplete).toBe(false);
  });

  it('addBusinessDays: 분기 말 다음 날부터 센다 / 이의 제기 5영업일 (10/8 통보 → 10/16)', () => {
    expect(addBusinessDays('2026-10-08', 5).date).toBe('2026-10-16'); // 10/9 한글날 제외
    expect(addBusinessDays('2026-09-30', 1).date).toBe('2026-10-01');
  });

  it('noticeDeadlineStatus', () => {
    const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);
    expect(noticeDeadlineStatus('2026-3Q', at(2026, 9, 20)).state).toBe('before-end');
    expect(noticeDeadlineStatus('2026-3Q', at(2026, 9, 30)).state).toBe('before-end');
    const open = noticeDeadlineStatus('2026-3Q', at(2026, 10, 7));
    expect(open.state).toBe('open');
    expect(open.remainingDays).toBe(1);
    expect(noticeDeadlineStatus('2026-3Q', at(2026, 10, 8)).state).toBe('today');
    const late = noticeDeadlineStatus('2026-3Q', at(2026, 10, 12));
    expect(late.state).toBe('overdue');
    expect(late.remainingDays).toBe(-4);
    expect(noticeDeadlineStatus('nope')).toBeNull();
  });
});

import { describeNoticeDeadline } from '../src/components/Kpi3NoticeDeadline.jsx';

describe('describeNoticeDeadline — 화면 문구', () => {
  const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);
  it('1Q·잘못된 형식은 표시하지 않음', () => {
    expect(describeNoticeDeadline('2026-1Q', { now: at(2026, 4, 3) })).toBeNull();
    expect(describeNoticeDeadline('x', { now: at(2026, 4, 3) })).toBeNull();
  });
  it('분기 말 이전·마감 임박·당일·경과', () => {
    expect(describeNoticeDeadline('2026-3Q', { now: at(2026, 9, 15) }).text).toContain('분기 말 + 5영업일');
    const soon = describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 7) });
    expect(soon.text).toBe('확정 통보 마감 2026-10-08 · D-1');
    expect(soon.urgent).toBe(true);
    const today = describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 8) });
    expect(today.text).toBe('확정 통보 마감 오늘 (2026-10-08)');
    const late = describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 12) });
    expect(late.text).toBe('확정 통보 마감 4일 경과 (2026-10-08)');
  });
  it('마감이 30일 넘게 지난 분기는 숨김', () => {
    expect(describeNoticeDeadline('2026-2Q', { now: at(2026, 9, 1) })).toBeNull();
  });
  it('확정일 표기와 공휴일 데이터 없는 연도 안내', () => {
    const r = describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 7), confirmedAt: '2026-10-06T03:00:00.000Z' });
    expect(r.text).toContain('확정일 2026-10-06');
    expect(r.note).toBeNull();
    const q4 = describeNoticeDeadline('2026-4Q', { now: at(2026, 12, 31) });
    expect(q4.note).toContain('주말만 제외한 추정');
  });
});
