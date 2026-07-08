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
