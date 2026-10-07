import { describe, expect, it } from 'vitest';
import { appealDeadlineStatus } from '../src/utils/businessDays.js';
import {
  APPEAL_STATUS,
  appealTimeliness,
  applyAppealPatch,
  createAppeal,
  isDateKey,
  normalizeAppeals,
  openAppealCount,
} from '../src/utils/kpiAppeals.js';

const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

describe('appealDeadlineStatus — 이의 제기 기한 (통보 후 5영업일)', () => {
  it('10/8 통보 → 10/16 (10/9 한글날 제외)', () => {
    const s = appealDeadlineStatus('2026-10-08', at(2026, 10, 8));
    expect(s.deadline).toBe('2026-10-16');
    expect(s.state).toBe('open');
    expect(s.remainingDays).toBe(8);
  });
  it('당일·경과', () => {
    expect(appealDeadlineStatus('2026-10-08', at(2026, 10, 16)).state).toBe('today');
    const late = appealDeadlineStatus('2026-10-08', at(2026, 10, 19));
    expect(late.state).toBe('overdue');
    expect(late.remainingDays).toBe(-3);
  });
  it('잘못된 날짜는 null', () => {
    expect(appealDeadlineStatus('')).toBeNull();
    expect(appealDeadlineStatus('2026/10/08')).toBeNull();
  });
});

describe('kpiAppeals', () => {
  it('isDateKey: 형식과 실제 날짜 검증', () => {
    expect(isDateKey('2026-10-08')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-1-8')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('createAppeal: 내용·접수일 검증, 기본 상태 접수', () => {
    const a = createAppeal({ receivedAt: '2026-10-12', text: '  다면 평가 N 확인 요청  ' }, new Date('2026-10-12T01:00:00Z'));
    expect(a.status).toBe(APPEAL_STATUS.RECEIVED);
    expect(a.text).toBe('다면 평가 N 확인 요청');
    expect(a.id).toMatch(/^a-/);
    expect(createAppeal({ receivedAt: '2026-10-12', text: '   ' })).toBeNull();
    expect(createAppeal({ receivedAt: 'x', text: 'ok' })).toBeNull();
  });

  it('applyAppealPatch: 상태·메모만 변경, 접수일·id 유지, 잘못된 상태 무시', () => {
    const a = createAppeal({ receivedAt: '2026-10-12', text: '이의' }, new Date('2026-10-12T01:00:00Z'));
    const b = applyAppealPatch(a, { status: APPEAL_STATUS.LEADER_REVIEW, reviewNote: '검토 중', receivedAt: '2000-01-01', id: 'x' }, new Date('2026-10-13T01:00:00Z'));
    expect(b.status).toBe('팀장 1차 검토');
    expect(b.reviewNote).toBe('검토 중');
    expect(b.receivedAt).toBe('2026-10-12');
    expect(b.id).toBe(a.id);
    expect(b.updatedAt).toBe('2026-10-13T01:00:00.000Z');
    expect(applyAppealPatch(a, { status: '이상한값' }).status).toBe(APPEAL_STATUS.RECEIVED);
  });

  it('appealTimeliness', () => {
    expect(appealTimeliness('2026-10-12', undefined)).toBe('no-notice');
    expect(appealTimeliness('2026-10-07', '2026-10-08')).toBe('before-notice');
    expect(appealTimeliness('2026-10-16', '2026-10-08')).toBe('in-time');
    expect(appealTimeliness('2026-10-19', '2026-10-08')).toBe('late');
  });

  it('normalizeAppeals / openAppealCount', () => {
    expect(normalizeAppeals(undefined)).toEqual([]);
    expect(normalizeAppeals([{ id: 'a' }, null, {}, 'x'])).toEqual([{ id: 'a' }]);
    expect(openAppealCount([{ id: 'a', status: '접수' }, { id: 'b', status: '종결' }])).toBe(1);
  });
});
