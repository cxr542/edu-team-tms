import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_FAILURES, resetLoginThrottleMemory } from '../server/api-utils/adminLoginThrottle.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => null }));

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

const login = async (password, ip = '7.7.7.7') => {
  const handler = (await import('../api/admin-session.js')).default;
  const res = createRes();
  await handler(
    {
      method: 'POST',
      headers: { referer: 'https://edu-team-tms-ten.vercel.app/admin', 'x-forwarded-for': ip },
      body: { password },
    },
    res
  );
  return res;
};

describe('admin-session login throttle', () => {
  beforeEach(() => {
    resetLoginThrottleMemory();
    process.env.TMS_ADMIN_GATE_PASSWORD = 'secret-gate';
    process.env.TMS_ADMIN_SESSION_SECRET = 'session-secret';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('locks an IP after repeated wrong passwords, even if the next one is correct', async () => {
    for (let i = 0; i < MAX_FAILURES; i += 1) expect((await login('wrong')).statusCode).toBe(401);
    const locked = await login('secret-gate');
    expect(locked.statusCode).toBe(429);
    expect(locked.body.error).toBe('too-many-attempts');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('does not affect other IPs and succeeds with the right password', async () => {
    for (let i = 0; i < MAX_FAILURES; i += 1) await login('wrong');
    const other = await login('secret-gate', '8.8.8.8');
    expect(other.statusCode).toBe(200);
    expect(other.headers['set-cookie']).toContain('tms-admin-session=');
  });

  it('a successful login resets the failure count', async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) await login('wrong');
    expect((await login('secret-gate')).statusCode).toBe(200);
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) expect((await login('wrong')).statusCode).toBe(401);
  });
});
