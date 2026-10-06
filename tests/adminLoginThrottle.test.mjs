import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_FAILURES,
  WINDOW_MS,
  checkLoginAllowed,
  clientIp,
  hashIp,
  recordLoginResult,
  resetLoginThrottleMemory,
} from '../server/api-utils/adminLoginThrottle.js';
import { makeFakeSupabase } from './helpers/fakeSupabase.mjs';

const req = (ip = '1.2.3.4') => ({ headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });

describe('admin login throttle', () => {
  beforeEach(() => {
    resetLoginThrottleMemory();
  });

  it('reads the first forwarded IP and stores only a hash', () => {
    expect(clientIp(req('9.9.9.9'))).toBe('9.9.9.9');
    expect(hashIp('9.9.9.9')).not.toContain('9.9.9.9');
  });

  it('blocks after MAX_FAILURES within the window, then releases', async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      expect((await checkLoginAllowed(req(), { now: t0 + i, client: null })).blocked).toBe(false);
      await recordLoginResult(req(), false, { now: t0 + i, client: null });
    }
    const blocked = await checkLoginAllowed(req(), { now: t0 + 10, client: null });
    expect(blocked.blocked).toBe(true);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect((await checkLoginAllowed(req('5.5.5.5'), { now: t0 + 10, client: null })).blocked).toBe(false);
    expect((await checkLoginAllowed(req(), { now: t0 + WINDOW_MS + 100, client: null })).blocked).toBe(false);
  });

  it('a successful login clears the failures', async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) await recordLoginResult(req(), false, { client: null });
    await recordLoginResult(req(), true, { client: null });
    await recordLoginResult(req(), false, { client: null });
    expect((await checkLoginAllowed(req(), { client: null })).blocked).toBe(false);
  });

  it('uses the shared DB log across instances (memory empty)', async () => {
    const db = makeFakeSupabase();
    const now = Date.now();
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      db.tables.admin_login_attempts.push({
        ip_hash: hashIp('1.2.3.4'),
        success: false,
        attempted_at: new Date(now - 1000 * (i + 1)).toISOString(),
      });
    }
    expect((await checkLoginAllowed(req(), { now, client: db })).blocked).toBe(true);
  });

  it('falls back to memory when the DB errors (does not lock the admin out on its own)', async () => {
    const broken = { from: () => { throw new Error('table missing'); } };
    expect((await checkLoginAllowed(req(), { client: broken })).blocked).toBe(false);
    await expect(recordLoginResult(req(), false, { client: broken })).resolves.toBeUndefined();
  });
});
