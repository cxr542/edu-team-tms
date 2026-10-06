/**
 * 관리자 로그인 무차별 대입 방어.
 *
 * - IP별로 최근 WINDOW_MS 안에 MAX_FAILURES 번 실패하면 잠금(429 + Retry-After).
 * - 서버리스 인스턴스 간 공유를 위해 Supabase `admin_login_attempts`(service role)에 기록한다.
 *   DB를 쓸 수 없거나 테이블이 아직 없으면 인스턴스 메모리 제한만 적용한다(로그인을 막지는 않는다).
 * - IP 는 해시로만 저장한다(원본 IP 미저장).
 */
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES = 5;
const TABLE = 'admin_login_attempts';

const memory = new Map(); // ipHash -> number[] (실패 시각)

function serviceClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function clientIp(req) {
  const fwd = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req?.headers?.['x-real-ip'] || '').trim() || 'unknown';
}

export function hashIp(ip) {
  const salt = String(process.env.TMS_ADMIN_SESSION_SECRET || 'tms-admin-throttle');
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

function memoryFailures(ipHash, now) {
  const recent = (memory.get(ipHash) || []).filter((t) => now - t < WINDOW_MS);
  memory.set(ipHash, recent);
  return recent;
}

/** @returns {Promise<{ blocked: boolean, retryAfterSec: number }>} */
export async function checkLoginAllowed(req, { now = Date.now(), client = serviceClient() } = {}) {
  const ipHash = hashIp(clientIp(req));
  let times = memoryFailures(ipHash, now);

  if (client) {
    try {
      const since = new Date(now - WINDOW_MS).toISOString();
      const { data, error } = await client
        .from(TABLE)
        .select('attempted_at')
        .eq('ip_hash', ipHash)
        .eq('success', false)
        .gte('attempted_at', since)
        .order('attempted_at', { ascending: true });
      if (!error && Array.isArray(data)) {
        const dbTimes = data.map((r) => Date.parse(r.attempted_at)).filter(Number.isFinite);
        if (dbTimes.length > times.length) times = dbTimes;
      }
    } catch {
      /* DB 불가 — 메모리 제한만 적용 */
    }
  }

  if (times.length < MAX_FAILURES) return { blocked: false, retryAfterSec: 0 };
  const oldestCounted = times[times.length - MAX_FAILURES];
  return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((oldestCounted + WINDOW_MS - now) / 1000)) };
}

export async function recordLoginResult(req, success, { now = Date.now(), client = serviceClient() } = {}) {
  const ipHash = hashIp(clientIp(req));
  if (success) memory.delete(ipHash);
  else memory.set(ipHash, [...memoryFailures(ipHash, now), now]);

  if (!client) return;
  try {
    if (success) {
      await client.from(TABLE).delete().eq('ip_hash', ipHash).eq('success', false);
    } else {
      await client.from(TABLE).insert({ ip_hash: ipHash, success: false });
      // 하루 지난 기록은 가끔 정리
      if (Math.random() < 0.05) {
        await client.from(TABLE).delete().lt('attempted_at', new Date(now - 24 * 60 * 60 * 1000).toISOString());
      }
    }
  } catch {
    /* 기록 실패는 로그인 흐름을 막지 않는다 */
  }
}

export function resetLoginThrottleMemory() {
  memory.clear();
}
