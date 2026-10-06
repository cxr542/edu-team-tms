import { describe, expect, it } from 'vitest';
import {
  MAX_DELETE_PER_ACTION,
  TYPED_CONFIRM_FROM,
  bulkDeleteConfirmation,
  checkDeletionGuard,
  isTypedConfirmationValid,
} from '../src/utils/ledgerDeleteGuard.js';
import { readFileSync } from 'node:fs';

describe('checkDeletionGuard', () => {
  it('allows ordinary deletes and nothing-to-delete', () => {
    expect(checkDeletionGuard(0, 110)).toEqual({ ok: true });
    expect(checkDeletionGuard(1, 110)).toEqual({ ok: true });
    expect(checkDeletionGuard(MAX_DELETE_PER_ACTION, 110)).toEqual({ ok: true });
  });
  it('blocks deleting the whole ledger, even when it is small', () => {
    expect(checkDeletionGuard(110, 110)).toMatchObject({ ok: false, reason: 'all' });
    expect(checkDeletionGuard(2, 2)).toMatchObject({ ok: false, reason: 'all' });
    expect(checkDeletionGuard(1, 1)).toMatchObject({ ok: false, reason: 'all' });
  });
  it('blocks more than the per-action cap', () => {
    const r = checkDeletionGuard(MAX_DELETE_PER_ACTION + 1, 110);
    expect(r).toMatchObject({ ok: false, reason: 'too-many' });
    expect(r.message).toContain(String(MAX_DELETE_PER_ACTION + 1));
  });
});

describe('bulkDeleteConfirmation', () => {
  it('always asks to type for "all visible" deletes, even for one row', () => {
    const c = bulkDeleteConfirmation({ count: 1, scopeLabel: '2026년 10월 1건', kind: 'all-visible' });
    expect(c.mode).toBe('typed');
    expect(c.phrase).toBe('1건 삭제');
    expect(c.message).toContain('1건 삭제');
  });
  it('uses a plain confirm for small selections and typing from the threshold', () => {
    expect(bulkDeleteConfirmation({ count: TYPED_CONFIRM_FROM - 1, scopeLabel: 'x', kind: 'selected' }).mode).toBe('confirm');
    expect(bulkDeleteConfirmation({ count: TYPED_CONFIRM_FROM, scopeLabel: 'x', kind: 'selected' }).mode).toBe('typed');
  });
  it('accepts only the exact phrase (surrounding spaces ok)', () => {
    expect(isTypedConfirmationValid(' 7건 삭제 ', '7건 삭제')).toBe(true);
    expect(isTypedConfirmationValid('7건', '7건 삭제')).toBe(false);
    expect(isTypedConfirmationValid('8건 삭제', '7건 삭제')).toBe(false);
    expect(isTypedConfirmationValid(null, '7건 삭제')).toBe(false);
  });
});

describe('wiring', () => {
  it('applies the guard in the server write hook and the typed confirm in App', () => {
    const hook = readFileSync('src/hooks/useServerLedger.js', 'utf8');
    expect(hook).toContain('checkDeletionGuard(plan.removes.length, txRef.current.length)');
    const app = readFileSync('src/App.jsx', 'utf8');
    expect(app).toContain("kind: 'all-visible'");
    expect(app).toContain('window.prompt(c.message');
    // 기존(Blob) 모드는 예전 확인창 문구를 그대로 쓴다.
    expect(app).toContain('legacyMessage');
  });
});
