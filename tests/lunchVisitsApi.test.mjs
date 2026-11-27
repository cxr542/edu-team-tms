import { describe, expect, it, vi } from 'vitest';
import { handleLunchVisits, kstDayKey } from '../server/api-utils/lunchVisits.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

const ORIGIN = 'https://edu-team-tms-ten.vercel.app';
// 2026-11-26 13:00 KST
const NOW = new Date('2026-11-26T04:00:00.000Z');
const member = (slug) => ({ referer: `${ORIGIN}/${slug}?module=lunch` });

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(body) {
      this.body = body ? JSON.parse(body) : null;
    },
  };
}

async function call(db, req, now = NOW) {
  const res = createRes();
  await handleLunchVisits({ headers: {}, url: '/api/lunch-visits', ...req }, res, db, { now });
  return res;
}

const row = (over = {}) => ({
  id: `v-${Math.random()}`,
  member_code: 'A',
  visited_on: '2026-11-24',
  spot_id: 'yeouido-003',
  spot_name: '여의도 순대국',
  category: '한식',
  ...over,
});

describe('kstDayKey', () => {
  it('UTC 15시 이후는 한국 날짜로 다음 날이다', () => {
    expect(kstDayKey(new Date('2026-11-25T15:30:00.000Z'))).toBe('2026-11-26');
    expect(kstDayKey(new Date('2026-11-25T14:59:00.000Z'))).toBe('2026-11-25');
  });
});

describe('/api/lunch-visits', () => {
  it('허용되지 않은 출처는 403', async () => {
    const db = makeFakeSupabase({ lunch_visits: [] });
    const res = await call(db, { method: 'GET', headers: { referer: 'https://evil.example/yhkim' } });
    expect(res.statusCode).toBe(403);
  });

  it('관리자 화면처럼 구성원이 없는 주소는 403', async () => {
    const db = makeFakeSupabase({ lunch_visits: [] });
    const res = await call(db, { method: 'POST', headers: { referer: `${ORIGIN}/admin?module=lunch` }, body: { spotId: 'x', spotName: 'x' } });
    expect(res.statusCode).toBe(403);
    expect(db.tables?.lunch_visits?.length ?? 0).toBe(0);
  });

  it('GET 은 주소의 구성원 기록만 최근 순으로 준다', async () => {
    const db = makeFakeSupabase({
      lunch_visits: [
        row({ visited_on: '2026-11-24' }),
        row({ visited_on: '2026-11-25', spot_id: 's2', spot_name: '칼국수' }),
        row({ member_code: 'B', visited_on: '2026-11-25' }),
        row({ visited_on: '2026-01-01' }),
      ],
    });
    const res = await call(db, { method: 'GET', headers: member('yhkim') });
    expect(res.statusCode).toBe(200);
    expect(res.body.memberCode).toBe('A');
    expect(res.body.today).toBe('2026-11-26');
    expect(res.body.visits.map((v) => v.day)).toEqual(['2026-11-25', '2026-11-24']);
    expect(res.body.visits[0]).toEqual({ day: '2026-11-25', spotId: 's2', spotName: '칼국수', category: '한식' });
  });

  it('POST 는 오늘(KST) 기록을 만들고, 같은 날 다시 보내면 바꾼다', async () => {
    const data = { lunch_visits: [] };
    const db = makeFakeSupabase(data);
    let res = await call(db, { method: 'POST', headers: member('wschoi'), body: { spotId: 's1', spotName: '백반마을', category: '한식', memberCode: 'A' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.visit).toEqual({ day: '2026-11-26', spotId: 's1', spotName: '백반마을', category: '한식' });

    res = await call(db, { method: 'POST', headers: member('wschoi'), body: { spotId: 's2', spotName: '순대국' } });
    expect(res.statusCode).toBe(200);

    const list = await call(db, { method: 'GET', headers: member('wschoi') });
    expect(list.body.visits).toHaveLength(1);
    expect(list.body.visits[0].spotId).toBe('s2');
    // 몸통의 memberCode 는 무시하고 주소의 구성원(B)으로 저장한다
    const other = await call(db, { method: 'GET', headers: member('yhkim') });
    expect(other.body.visits).toHaveLength(0);
  });

  it('POST 값 검사', async () => {
    const db = makeFakeSupabase({ lunch_visits: [] });
    expect((await call(db, { method: 'POST', headers: member('yhkim'), body: { spotName: 'x' } })).statusCode).toBe(400);
    expect((await call(db, { method: 'POST', headers: member('yhkim'), body: { spotId: 'x' } })).statusCode).toBe(400);
    expect((await call(db, { method: 'POST', headers: member('yhkim'), body: { spotId: 'x', spotName: 'y'.repeat(121) } })).statusCode).toBe(400);
  });

  it('DELETE 는 오늘 기록만 지운다', async () => {
    const db = makeFakeSupabase({
      lunch_visits: [row({ visited_on: '2026-11-26' }), row({ visited_on: '2026-11-25' })],
    });
    const res = await call(db, { method: 'DELETE', headers: member('yhkim') });
    expect(res.statusCode).toBe(200);
    const list = await call(db, { method: 'GET', headers: member('yhkim') });
    expect(list.body.visits.map((v) => v.day)).toEqual(['2026-11-25']);
  });

  it('DB 오류는 일반 문구 500', async () => {
    const db = { from: () => { const q = { select: () => q, eq: () => q, gte: () => q, order: () => q, then: (r) => r({ data: null, error: { message: 'permission denied' } }) }; return q; } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(db, { method: 'GET', headers: member('yhkim') });
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body.message).not.toContain('permission');
  });

  it('지원하지 않는 메서드는 405', async () => {
    const res = await call(makeFakeSupabase({ lunch_visits: [] }), { method: 'PUT', headers: member('yhkim') });
    expect(res.statusCode).toBe(405);
  });
});
