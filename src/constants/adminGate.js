const STORAGE_KEY = 'tms-admin-gate-v1';

export function getAdminGatePassword() {
  const fromEnv = import.meta.env.VITE_ADMIN_GATE_PASSWORD;
  return typeof fromEnv === 'string' ? fromEnv.trim() : '';
}

export function isAdminGateConfigured() {
  if (import.meta.env.PROD) return true;
  return getAdminGatePassword().length > 0;
}

export function isAdminGateUnlocked() {
  if (typeof sessionStorage === 'undefined') return false;
  if (!isAdminGateConfigured()) {
    return import.meta.env.DEV;
  }
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

export function verifyAdminGatePassword(input) {
  const expected = getAdminGatePassword();
  if (!expected) {
    return import.meta.env.DEV;
  }
  return String(input || '') === expected;
}

export function unlockAdminGate() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, '1');
}

export function lockAdminGate() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** 새 탭에서는 sessionStorage가 비어 있으므로 서버 세션 쿠키로 복원을 시도한다. */
export async function restoreAdminGateFromServer() {
  if (typeof fetch === 'undefined') return false;
  try {
    const response = await fetch('/api/admin-session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => ({}));
    if (payload?.active !== true) return false;
    unlockAdminGate();
    return true;
  } catch {
    return false;
  }
}

/** 로그아웃 — 이 탭의 표시와 서버 세션 쿠키를 함께 지운다. */
export async function logoutAdminGate() {
  lockAdminGate();
  if (typeof fetch === 'undefined') return;
  try {
    await fetch('/api/admin-session', { method: 'DELETE', credentials: 'include' });
  } catch {
    /* 네트워크 실패 시에도 이 탭은 잠긴 상태로 둔다 */
  }
}
