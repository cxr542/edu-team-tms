import { describe, expect, it, vi } from 'vitest';
import { handleLunchSpots, sanitizeSpotInput } from '../server/api-utils/lunchSpots.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));
vi.mock('../server/api-utils/adminSession.js', () => ({
  hasValidAdminSession: (req) => req.headers?.cookie === 'admin-ok',
}));

const ORIGIN = 'https://edu-team-tms-ten.vercel.app';
const NOW = new Date('2026-11-27T04:00:00.000Z');
const member = (slug) => ({ referer: `${ORIGIN}/${slug}?module=lunch` });
const admin = (ok = true) => ({ referer: `${ORIGIN}/admin?module=lunch`, ...(ok ? { cookie: 'admin-ok' } : {}) });
const ID1 = '11111111-1111-4111-8111-111111111111';

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

async function call(db, req) {
  const res = createRes();
  await handleLunchSpots({ headers: {}, url: '/api/lunch-spots', ...req }, res, db, { now: NOW });
  return res;
}

const seedRow = (over = {}) => ({
  id: ID1,
  name: '순대실록',
  data: { category: '순대', priceLevel: 1, walkMinutes: 6, tags: [] },
  created_by: 'B',
  created_at: '2026-11-20T00:00:00.000Z',
  updated_at: '2026-11-20T00:00:00.000Z',
  ...over,
});

describe('sanitizeSpotInput', () => {
  it('저장할 값만 고르고 길이·범위를 자른다', () => {
    const out = sanitizeSpotInput({
      name: '  백반마을  ',
      category: '한식',
      priceLevel: 9,
      walkMinutes: 500,
      tags: ['quick', 'quick', 'x'.repeat(50)],
      menuHints: '김치찌개, 제육',
      menus: [{ name: '김치찌개', priceWon: 9000 }, { name: '' }],
      mapUrl: 'javascript:alert(1)',
      weight: 99,
      source: 'custom',
      id: 'evil',
    });
    expect(out.name).toBe('백반마을');
    expect(out.data).toMatchObject({
      category: '한식',
      priceLevel: 0,
      walkMinutes: 120,
      menuHints: ['김치찌개', '제육'],
      menus: [{ name: '김치찌개', priceWon: 9000 }],
      mapUrl: '',
      weight: 5,
    });
    expect(out.data.tags).toEqual(['quick', 'x'.repeat(30)]);
    expect(out.data).not.toHaveProperty('source');
    expect(out.data).not.toHaveProperty('id');
    expect(sanitizeSpotInput({ name: '  ' })).toBeNull();
  });
});

describe('/api/lunch-spots', () => {
  it('허용되지 않은 출처·구성원 아닌 주소·로그인 안 한 관리자는 403', async () => {
    const db = makeFakeSupabase({ lunch_spots: [] });
    expect((await call(db, { method: 'GET', headers: { referer: 'https://evil.example/yhkim' } })).statusCode).toBe(403);
    expect((await call(db, { method: 'GET', headers: { referer: `${ORIGIN}/` } })).statusCode).toBe(403);
    expect((await call(db, { method: 'GET', headers: admin(false) })).statusCode).toBe(403);
    expect((await call(db, { method: 'GET', headers: admin(true) })).statusCode).toBe(200);
  });

  it('구성원 A 가 등록한 식당을 B 도 본다', async () => {
    const db = makeFakeSupabase({ lunch_spots: [] });
    const created = await call(db, { method: 'POST', headers: member('yhkim'), body: { name: '백반마을', category: '한식' } });
    expect(created.statusCode).toBe(200);
    expect(created.body.spot).toMatchObject({ name: '백반마을', category: '한식', source: 'team', createdBy: 'A' });
    expect(created.body.spot.id).toMatch(/^team-/);

    const list = await call(db, { method: 'GET', headers: member('wschoi') });
    expect(list.body.actor).toBe('B');
    expect(list.body.spots.map((s) => s.name)).toEqual(['백반마을']);
  });

  it('같은 이름(공백 무시)은 409', async () => {
    const db = makeFakeSupabase({ lunch_spots: [seedRow()] });
    const res = await call(db, { method: 'POST', headers: member('yhkim'), body: { name: '순대 실록' } });
    expect(res.statusCode).toBe(409);
    expect(res.body.id).toBe(`team-${ID1}`);
  });

  it('수정·삭제는 등록한 구성원 또는 관리자만', async () => {
    const db = makeFakeSupabase({ lunch_spots: [seedRow()] });
    const url = `/api/lunch-spots?id=team-${ID1}`;
    const byOther = await call(db, { method: 'PATCH', url, headers: member('yhkim'), body: { name: '순대실록 여의도점' } });
    expect(byOther.statusCode).toBe(403);

    const byOwner = await call(db, { method: 'PATCH', url, headers: member('wschoi'), body: { name: '순대실록 여의도점', category: '순대' } });
    expect(byOwner.statusCode).toBe(200);
    expect(byOwner.body.spot).toMatchObject({ name: '순대실록 여의도점', createdBy: 'B' });

    expect((await call(db, { method: 'DELETE', url, headers: member('hyshin') })).statusCode).toBe(403);
    expect((await call(db, { method: 'DELETE', url, headers: admin(true) })).statusCode).toBe(200);
    const list = await call(db, { method: 'GET', headers: member('yhkim') });
    expect(list.body.spots).toHaveLength(0);
  });

  it('잘못된 id 는 400, 없는 식당은 404, 이름 없으면 400', async () => {
    const db = makeFakeSupabase({ lunch_spots: [] });
    expect((await call(db, { method: 'DELETE', url: '/api/lunch-spots?id=nope', headers: member('yhkim') })).statusCode).toBe(400);
    expect(
      (await call(db, { method: 'DELETE', url: `/api/lunch-spots?id=team-${ID1}`, headers: member('yhkim') })).statusCode
    ).toBe(404);
    expect((await call(db, { method: 'POST', headers: member('yhkim'), body: { category: '한식' } })).statusCode).toBe(400);
  });

  it('DB 오류는 일반 문구 500, 지원하지 않는 메서드는 405', async () => {
    const db = { from: () => { const q = { select: () => q, order: () => q, then: (r) => r({ data: null, error: { message: 'permission denied' } }) }; return q; } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(db, { method: 'GET', headers: member('yhkim') });
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body.message).not.toContain('permission');
    expect((await call(makeFakeSupabase({ lunch_spots: [] }), { method: 'PUT', headers: member('yhkim') })).statusCode).toBe(405);
  });
});
