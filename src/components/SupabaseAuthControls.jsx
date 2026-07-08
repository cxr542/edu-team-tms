import React, { useEffect, useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import {
  getSupabaseSession,
  requestSupabaseMagicLink,
  signOutSupabase,
  subscribeSupabaseAuthState,
} from '../utils/supabaseAuth';

export default function SupabaseAuthControls() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getSupabaseSession().then((result) => {
      if (active && result.ok) setSession(result.data);
    });
    const unsubscribe = subscribeSupabaseAuthState((nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (session?.user?.email) {
    return (
      <div className="project-supabase-auth project-supabase-auth--signed-in">
        <p className="project-supabase-auth__title">Supabase 로그인됨</p>
        <p className="project-supabase-auth__email" title={session.user.email}>
          {session.user.email}
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm project-supabase-auth__button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await signOutSupabase();
            setBusy(false);
            setMessage(result.message);
            if (result.ok) setSession(null);
          }}
        >
          <LogOut size={14} aria-hidden />
          로그아웃
        </button>
        {message && <p className="project-supabase-auth__message">{message}</p>}
      </div>
    );
  }

  return (
    <form
      className="project-supabase-auth"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const result = await requestSupabaseMagicLink(email);
        setBusy(false);
        setMessage(result.message);
      }}
    >
      <p className="project-supabase-auth__title">공지 등록용 Supabase 로그인</p>
      <p className="project-supabase-auth__help" id="supabase-auth-help">
        공지 등록·수정 전에 관리자 이메일로 로그인하세요.
      </p>
      <label className="project-supabase-auth__label" htmlFor="supabase-auth-email">
        관리자 이메일
      </label>
      <input
        id="supabase-auth-email"
        type="email"
        autoComplete="email"
        aria-describedby="supabase-auth-help"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="예: name@okestro.com"
        disabled={busy}
      />
      <button type="submit" className="btn btn-primary btn-sm project-supabase-auth__button" disabled={busy}>
        <LogIn size={14} aria-hidden />
        {busy ? '로그인 링크 전송 중…' : '로그인 링크 보내기'}
      </button>
      {message && <p className="project-supabase-auth__message">{message}</p>}
    </form>
  );
}
