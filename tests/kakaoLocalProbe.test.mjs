import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/kakao-local.js';

function makeReq(url) {
  return {
    method: 'GET',
    url,
    headers: { host: 'edu-team-tms-ten.vercel.app', referer: 'https://edu-team-tms-ten.vercel.app/yhkim' },
  };
}

function makeRes() {
  return {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(text) {
      this.body = text;
    },
  };
}

describe('kakao-local probe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('키가 있으면 카카오를 부르지 않고 available:true 를 돌려준다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = makeRes();
    await handler(makeReq('/api/kakao-local?probe=1'), res, { apiKey: 'test-key' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ available: true, places: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('키가 없으면 503 available:false', async () => {
    const res = makeRes();
    await handler(makeReq('/api/kakao-local?probe=1'), res, { apiKey: '' });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).available).toBe(false);
  });
});

describe('kakao-local sort / categoryPath', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const doc = { id: '1', place_name: '빵집', category_name: '음식점 > 간식 > 제과,베이커리', distance: '160', x: '1', y: '2' };

  it('food 검색은 기본 거리순, sort=accuracy 면 정확도순으로 묻고 분류 경로를 돌려준다', async () => {
    const urls = [];
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      urls.push(String(u));
      return { ok: true, json: async () => ({ documents: [doc], meta: { is_end: true } }) };
    }));
    let res = makeRes();
    await handler(makeReq('/api/kakao-local?query=한식&purpose=food&radius=3000'), res, { apiKey: 'k' });
    res = makeRes();
    await handler(makeReq('/api/kakao-local?query=한식&purpose=food&radius=3000&sort=accuracy'), res, { apiKey: 'k' });
    expect(new URL(urls[0]).searchParams.get('sort')).toBe('distance');
    expect(new URL(urls[1]).searchParams.get('sort')).toBe('accuracy');
    expect(new URL(urls[1]).searchParams.get('radius')).toBe('3000');
    expect(JSON.parse(res.body).places[0].categoryPath).toBe('음식점 > 간식 > 제과,베이커리');
  });

  it('알 수 없는 sort 값은 거리순', async () => {
    const urls = [];
    vi.stubGlobal('fetch', vi.fn(async (u) => {
      urls.push(String(u));
      return { ok: true, json: async () => ({ documents: [], meta: {} }) };
    }));
    await handler(makeReq('/api/kakao-local?query=x&purpose=food&sort=evil'), makeRes(), { apiKey: 'k' });
    expect(new URL(urls[0]).searchParams.get('sort')).toBe('distance');
  });
});
