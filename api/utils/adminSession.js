import crypto from 'crypto';

export const ADMIN_SESSION_COOKIE = 'tms-admin-session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function getSessionSecret() {
  return String(process.env.TMS_ADMIN_SESSION_SECRET || '').trim();
}

function getAdminPassword() {
  return String(process.env.TMS_ADMIN_GATE_PASSWORD || '').trim();
}

export function isAdminSessionConfigured() {
  return Boolean(getSessionSecret() && getAdminPassword());
}

export function verifyAdminPassword(input) {
  const expected = getAdminPassword();
  if (!expected) return false;
  const provided = Buffer.from(String(input || ''));
  const target = Buffer.from(expected);
  if (provided.length !== target.length) return false;
  return crypto.timingSafeEqual(provided, target);
}

function signPayload(payload) {
  const secret = getSessionSecret();
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function readCookieValue(cookieHeader = '', name = ADMIN_SESSION_COOKIE) {
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`);
  const match = String(cookieHeader || '').match(pattern);
  return match ? decodeURIComponent(match[1]) : '';
}

export function createAdminSessionCookie() {
  if (!isAdminSessionConfigured()) return null;

  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_MS;
  const payload = `${issuedAt}.${expiresAt}`;
  const signature = signPayload(payload);
  if (!signature) return null;

  const value = `${payload}.${signature}`;
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function hasValidAdminSession(req) {
  if (!isAdminSessionConfigured()) return false;

  const raw = readCookieValue(req?.headers?.cookie || '', ADMIN_SESSION_COOKIE);
  if (!raw) return false;

  const [issuedAtRaw, expiresAtRaw, signature] = raw.split('.');
  if (!issuedAtRaw || !expiresAtRaw || !signature) return false;

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;

  const payload = `${issuedAtRaw}.${expiresAtRaw}`;
  const expected = signPayload(payload);
  if (!expected) return false;

  const providedSig = Buffer.from(signature);
  const expectedSig = Buffer.from(expected);
  if (providedSig.length !== expectedSig.length) return false;
  return crypto.timingSafeEqual(providedSig, expectedSig);
}
