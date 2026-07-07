import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

function result({ ok, status, message, data = null }) {
  return { ok, status, message, data };
}

function disabledResult() {
  return result({
    ok: false,
    status: 'disabled',
    message: 'Supabase environment variables are not configured.',
  });
}

function clientResult() {
  if (!isSupabaseConfigured) return { client: null, failure: disabledResult() };
  const client = getSupabaseClient();
  if (!client) {
    return {
      client: null,
      failure: result({ ok: false, status: 'disabled', message: 'Supabase client is not available.' }),
    };
  }
  return { client, failure: null };
}

export async function getSupabaseSession() {
  const { client, failure } = clientResult();
  if (failure) return failure;
  const { data, error } = await client.auth.getSession();
  if (error) return result({ ok: false, status: 'error', message: error.message });
  return result({ ok: true, status: data.session ? 'authenticated' : 'anonymous', message: '', data: data.session });
}

export async function requestSupabaseMagicLink(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail.includes('@')) {
    return result({ ok: false, status: 'error', message: '유효한 이메일 주소를 입력하세요.' });
  }
  const { client, failure } = clientResult();
  if (failure) return failure;
  const redirectTo = typeof window === 'undefined' ? undefined : `${window.location.origin}${window.location.pathname}`;
  const { error } = await client.auth.signInWithOtp({ email: normalizedEmail, options: { emailRedirectTo: redirectTo } });
  if (error) return result({ ok: false, status: 'error', message: error.message });
  return result({ ok: true, status: 'sent', message: '로그인 링크를 이메일로 보냈습니다.' });
}

export async function signOutSupabase() {
  const { client, failure } = clientResult();
  if (failure) return failure;
  const { error } = await client.auth.signOut();
  if (error) return result({ ok: false, status: 'error', message: error.message });
  return result({ ok: true, status: 'anonymous', message: 'Supabase에서 로그아웃했습니다.' });
}

export function subscribeSupabaseAuthState(onChange) {
  const { client, failure } = clientResult();
  if (failure) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => onChange(session));
  return () => data.subscription.unsubscribe();
}
