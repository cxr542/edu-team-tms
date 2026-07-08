import React, { useState } from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import {
  isAdminGateConfigured,
  unlockAdminGate,
  verifyAdminGatePassword,
} from '../constants/adminGate';
import { withAppBase } from '../utils/appRoute';

export default function AdminGatePage({ onUnlocked }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = isAdminGateConfigured();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!configured && !import.meta.env.DEV) {
      setError('운영 환경에 관리자 접근 비밀번호가 설정되지 않았습니다.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/admin-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.ok) {
        unlockAdminGate();
        onUnlocked?.();
        return;
      }
      if (response.status === 401) {
        setError(payload.message || '비밀번호가 올바르지 않습니다.');
        return;
      }
      if (import.meta.env.DEV && verifyAdminGatePassword(password)) {
        unlockAdminGate();
        onUnlocked?.();
        return;
      }
      setError(payload.message || '비밀번호가 올바르지 않습니다.');
    } catch {
      if (import.meta.env.DEV && verifyAdminGatePassword(password)) {
        unlockAdminGate();
        onUnlocked?.();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="main-content admin-gate">
      <div className="admin-gate__card">
        <div className="admin-gate__icon" aria-hidden>
          <Lock size={28} />
        </div>
        <h1 className="admin-gate__title">관리자 화면</h1>
        <p className="admin-gate__lead">
          팀 빌딩비 장부·KPI·승인 메뉴입니다. 교육팀 관리자만 접속하세요.
        </p>
        {!configured && import.meta.env.DEV && (
          <p className="admin-gate__hint">
            로컬 개발: <code>VITE_ADMIN_GATE_PASSWORD</code> 미설정 시 게이트가 열려 있습니다.
          </p>
        )}
        {!configured && !import.meta.env.DEV && (
          <p className="admin-gate__error">
            운영 배포에 <code>VITE_ADMIN_GATE_PASSWORD</code> 환경 변수를 설정해야 합니다.
          </p>
        )}
        <form className="admin-gate__form" onSubmit={handleSubmit}>
          <label className="admin-gate__label" htmlFor="admin-gate-password">
            접근 비밀번호
          </label>
          <input
            id="admin-gate-password"
            type="password"
            className="form-input admin-gate__input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!configured && !import.meta.env.DEV}
            placeholder={configured ? '팀 관리용 비밀번호' : '환경 변수 설정 필요'}
          />
          {error && (
            <p className="admin-gate__error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary admin-gate__submit"
            disabled={busy || (!configured && !import.meta.env.DEV)}
          >
            들어가기
          </button>
        </form>
        <a className="admin-gate__back" href={withAppBase('/')}>
          <ArrowLeft size={16} aria-hidden />
          접속 안내로 돌아가기
        </a>
      </div>
    </main>
  );
}
