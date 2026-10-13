import React, { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import {
  ADMIN_GATE_HINT_MAX_LENGTH,
  fetchAdminGateHint,
  saveAdminGateHint,
} from '../utils/adminGateHint';
import { describeLedgerClientError } from '../utils/ledgerApiClient';

export default function AdminGateHintModal({ isOpen, onClose }) {
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    let alive = true;
    setMessage('');
    setError('');
    setLoading(true);
    fetchAdminGateHint().then((value) => {
      if (!alive) return;
      setHint(value);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await saveAdminGateHint(hint);
      setMessage(hint.trim() ? '힌트를 저장했습니다.' : '힌트를 지웠습니다. 로그인 화면에 표시되지 않습니다.');
    } catch (err) {
      setError(describeLedgerClientError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay active" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="admin-gate-hint-title"
      >
        <div className="modal-header-row">
          <h3 id="admin-gate-hint-title">
            <KeyRound size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden />
            로그인 비밀번호 힌트
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body-stack">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              관리자 로그인 화면의 「비밀번호 힌트」에 표시됩니다. 로그인 전에 누구나 볼 수 있으니{' '}
              <strong>비밀번호 자체는 입력하지 마세요.</strong> 비워서 저장하면 힌트가 사라집니다.
            </p>
            <input
              type="text"
              className="form-input"
              value={hint}
              maxLength={ADMIN_GATE_HINT_MAX_LENGTH}
              disabled={loading || busy}
              onChange={(e) => setHint(e.target.value)}
              placeholder="예: 팀 약어 + 설립연도"
              aria-label="비밀번호 힌트"
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              {hint.length}/{ADMIN_GATE_HINT_MAX_LENGTH}
            </p>
            {message && <p style={{ fontSize: '0.85rem', margin: 0 }}>{message}</p>}
            {error && (
              <p role="alert" style={{ fontSize: '0.85rem', color: 'var(--danger, #dc2626)', margin: 0 }}>
                {error}
              </p>
            )}
          </div>
          <div className="modal-footer-row">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              닫기
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || busy}>
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
