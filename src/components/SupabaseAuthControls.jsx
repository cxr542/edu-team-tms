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
      <span className="project-supabase-auth">
        <span className="project-supabase-auth__label" title={session.user.email}>
          Supabase 로그인: {session.user.email}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
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
        {message && <span className="project-supabase-auth__message">{message}</span>}
      </span>
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
      <label className="project-supabase-auth__label" htmlFor="supabase-auth-email">
        Supabase 로그인 이메일
      </label>
      <input
        id="supabase-auth-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="이메일"
        disabled={busy}
      />
      <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
        <LogIn size={14} aria-hidden />
        {busy ? '전송 중…' : 'Supabase 로그인'}
      </button>
      {message && <span className="project-supabase-auth__message">{message}</span>}
    </form>
  );
}
