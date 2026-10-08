import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionCookie } from '../server/api-utils/adminSession.js';

const headMock = vi.fn();
const putMock = vi.fn();

vi.mock('@vercel/blob', () => ({
  head: (...args) => headMock(...args),
  put: (...args) => putMock(...args),
}));

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
  };
}

async function loadHandler() {
  const mod = await import('../api/kpi-quarter-snapshot.js');
  return mod.default;
}

const submittedLeader = {
  leaderDetail: {
    memberSelf: '4',
    managerScore: '',
    note: '',
    submissionStatus: 'submitted',
    submittedAt: '2026-10-01T00:00:00.000Z',
    submittedBy: 'C',
  },
};

function body(extra = {}) {
  return { memberCode: 'C', yearQuarter: '2026-3Q', quarter: submittedLeader, ...extra };
}

describe('kpi-quarter-snapshot API', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    headMock.mockReset();
    putMock.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    delete process.env.BLOB_STORE_ID;
  });

  it('다른 구성원 경로의 POST 는 Blob 접근 전에 거부', async () => {
    const handler = await loadHandler();
    const res = createRes();
    await handler(
      { method: 'POST', headers: { referer: 'https://edu-team-tms-ten.vercel.app/wschoi?module=competency' }, body: body() },
      res
    );
    expect(res.statusCode).toBe(403);
    expect(headMock).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });

  it('본인 경로 POST 는 구성원 권한으로 저장된다', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    putMock.mockResolvedValue({ url: 'https://blob.example/kpi-operational/quarters-latest.json' });
    const handler = await loadHandler();
    const res = createRes();
    await handler(
      { method: 'POST', headers: { referer: 'https://edu-team-tms-ten.vercel.app/hyshin?module=competency' }, body: body() },
      res
    );
    const out = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(out.role).toBe('member');
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0][0]).toBe('kpi-operational/quarters-latest.json');
    expect(out.snapshot.kpiOperational.quarters['2026-3Q'].C.leaderDetail.submissionStatus).toBe('submitted');
  });

  it('구성원이 보낸 확정 점수·승인 상태는 서버가 반영하지 않는다', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    putMock.mockResolvedValue({ url: 'x' });
    const handler = await loadHandler();
    const res = createRes();
    const forged = {
      ...submittedLeader,
      leaderDetail: { ...submittedLeader.leaderDetail, submissionStatus: 'approved', reviewedAt: '2026-10-02T00:00:00.000Z' },
      quarter: { level: 5, locked: true },
    };
    await handler(
      { method: 'POST', headers: { referer: 'https://edu-team-tms-ten.vercel.app/hyshin' }, body: body({ quarter: forged }) },
      res
    );
    // 반영 가능한 섹션이 없고 빈 레코드라 400 (EMPTY_RECORD)
    expect(res.statusCode).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
  });

  it('관리자 세션은 팀장 권한으로 저장한다', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    putMock.mockResolvedValue({ url: 'x' });
    const cookie = createAdminSessionCookie();
    const handler = await loadHandler();
    const res = createRes();
    await handler(
      {
        method: 'POST',
        headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin?module=kpi', cookie: cookie.split(';')[0] },
        body: body(),
      },
      res
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).role).toBe('manager');
  });

  it('세션 없이 admin 경로를 흉내 내면 거부', async () => {
    const handler = await loadHandler();
    const res = createRes();
    await handler(
      { method: 'POST', headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin?module=kpi' }, body: body() },
      res
    );
    expect(res.statusCode).toBe(403);
    expect(putMock).not.toHaveBeenCalled();
  });

  it('잘못된 키·본문은 400', async () => {
    const handler = await loadHandler();
    const referer = 'https://edu-team-tms-ten.vercel.app/hyshin';
    for (const b of [body({ yearQuarter: '2026-5Q' }), body({ quarter: null }), body({ memberCode: 'Z' })]) {
      const res = createRes();
      await handler({ method: 'POST', headers: { referer }, body: b }, res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('Blob 읽기 실패 시 저장을 중단(503)한다', async () => {
    headMock.mockRejectedValue(Object.assign(new Error('server exploded'), { status: 500 }));
    const handler = await loadHandler();
    const res = createRes();
    await handler(
      { method: 'POST', headers: { referer: 'https://edu-team-tms-ten.vercel.app/hyshin' }, body: body() },
      res
    );
    expect(res.statusCode).toBe(503);
    expect(putMock).not.toHaveBeenCalled();
  });

  it('GET 은 빈 스냅샷도 형식대로 응답', async () => {
    headMock.mockRejectedValue(new Error('not found'));
    const handler = await loadHandler();
    const res = createRes();
    await handler({ method: 'GET', headers: { referer: 'https://edu-team-tms-ten.vercel.app/hyshin' } }, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).kpiOperational.quarters).toEqual({});
  });
});
