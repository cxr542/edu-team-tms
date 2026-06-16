import { describe, expect, it } from 'vitest';
import {
  getAdminGatePassword,
  isAdminGateConfigured,
  verifyAdminGatePassword,
} from '../src/constants/adminGate.js';

describe('admin gate', () => {
  it('reads password from VITE_ADMIN_GATE_PASSWORD', () => {
    expect(typeof getAdminGatePassword()).toBe('string');
  });

  it('reports configured when env password is non-empty', () => {
    const configured = isAdminGateConfigured();
    const password = getAdminGatePassword();
    expect(configured).toBe(password.length > 0);
  });

  it('verifies password only when configured', () => {
    const expected = getAdminGatePassword();
    if (expected) {
      expect(verifyAdminGatePassword(expected)).toBe(true);
      expect(verifyAdminGatePassword('wrong')).toBe(false);
    } else if (import.meta.env.DEV) {
      expect(verifyAdminGatePassword('anything')).toBe(true);
    }
  });
});
