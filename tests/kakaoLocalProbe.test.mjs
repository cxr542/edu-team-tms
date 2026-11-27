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
