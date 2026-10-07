import { describe, expect, it } from 'vitest';
import {
  defaultQuarterRecord,
  normalizeKpiOperationalStore,
} from '../src/constants/kpiOperationalStore.js';
import { describeNoticeDeadline } from '../src/components/Kpi3NoticeDeadline.jsx';

const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);

describe('분기 레코드 — 통보일·이의 기록 필드', () => {
  it('기본 레코드: noticedAt=null, appeals=[]', () => {
    const rec = defaultQuarterRecord('A');
    expect(rec.quarter.noticedAt).toBeNull();
    expect(rec.appeals).toEqual([]);
  });

  it('필드가 없는 기존 저장 레코드를 읽어도 값은 그대로, 새 필드만 기본값으로 채움', () => {
    const old = {
      quarters: {
        '2026-2Q': {
          A: {
            memos: [],
            quarter: { level: 3.6, dm: 4.25, leader: 3.64, practice: 4, composite: 3.81, grade: 'B', locked: true, confirmedAt: '2026-07-06T01:00:00.000Z' },
          },
        },
      },
    };
    const n = normalizeKpiOperationalStore(old).quarters['2026-2Q'].A;
    expect(n.quarter.noticedAt).toBeNull();
    expect(n.appeals).toEqual([]);
    // 저장된 점수·등급·확정은 재계산·변경하지 않는다
    expect(n.quarter.composite).toBe(3.81);
    expect(n.quarter.grade).toBe('B');
    expect(n.quarter.locked).toBe(true);
  });

  it('통보일·이의 기록이 있는 레코드는 정규화 후에도 보존', () => {
    const raw = {
      quarters: {
        '2026-3Q': {
          A: {
            quarter: { noticedAt: '2026-10-08' },
            appeals: [{ id: 'a-1', receivedAt: '2026-10-12', text: '이의', status: '접수' }],
          },
        },
      },
    };
    const n = normalizeKpiOperationalStore(raw).quarters['2026-3Q'].A;
    expect(n.quarter.noticedAt).toBe('2026-10-08');
    expect(n.appeals).toHaveLength(1);
    expect(n.appeals[0].id).toBe('a-1');
  });
});

describe('describeNoticeDeadline — 통보일이 기록된 경우', () => {
  it('통보 완료 + 이의 제기 기한(D-n)', () => {
    const r = describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 9), noticedAt: '2026-10-08' });
    expect(r.text).toBe('확정 통보 완료 2026-10-08 · 이의 제기 기한 2026-10-16 · D-7');
    expect(r.urgent).toBe(false);
    expect(r.note).toBeNull();
  });
  it('기한 임박·당일·경과', () => {
    expect(describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 14), noticedAt: '2026-10-08' }).urgent).toBe(true);
    expect(describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 16), noticedAt: '2026-10-08' }).text).toContain('오늘 마감');
    const late = describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 20), noticedAt: '2026-10-08' });
    expect(late.text).toContain('기한 경과');
    expect(late.urgent).toBe(false);
  });
  it('통보가 마감 후에 기록되면 안내, 오래된 분기도 숨기지 않음', () => {
    const r = describeNoticeDeadline('2026-3Q', { now: at(2026, 12, 1), noticedAt: '2026-10-12' });
    expect(r).not.toBeNull();
    expect(r.note).toContain('마감(2026-10-08) 후에 기록');
  });
  it('통보일이 잘못되면 통보 전 문구로 되돌아감', () => {
    const r = describeNoticeDeadline('2026-3Q', { now: at(2026, 10, 7), noticedAt: 'bad' });
    expect(r.text).toBe('확정 통보 마감 2026-10-08 · D-1');
  });
});
