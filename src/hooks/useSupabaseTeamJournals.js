import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTeamJournalSnapshotFromSupabase } from '../utils/supabaseJournalSnapshot';

/** 팀 일지를 다시 읽는 간격. 쓰기 없는 가벼운 조회라 길게 둔다. */
const REFRESH_MS = 5 * 60 * 1000;

const INITIAL = { status: 'idle', memberJournals: null, updatedAtByMember: null, fetchedAt: null, message: '', loading: false };

/**
 * Supabase 에 저장된 A/B/C 일지를 읽기 전용으로 가져온다(관리자 세션 필요).
 * 브라우저 localStorage 에 합치거나 쓰지 않는다. 실패하면 직전에 읽은 값을 그대로 둔다.
 * status: idle | loading | ok | empty(저장된 일지 없음) | error
 */
export function useSupabaseTeamJournals(enabled) {
  const [state, setState] = useState(INITIAL);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestRef.current;
    setState((s) => ({ ...s, loading: true, status: s.memberJournals ? s.status : 'loading' }));
    const result = await fetchTeamJournalSnapshotFromSupabase();
    if (id !== requestRef.current) return;
    if (result.ok && result.snapshot) {
      setState({
        status: 'ok',
        memberJournals: result.snapshot.memberJournals,
        updatedAtByMember: result.snapshot.meta?.memberUpdatedAt || null,
        fetchedAt: new Date(),
        message: '',
        loading: false,
      });
    } else if (result.ok) {
      setState({ status: 'empty', memberJournals: null, updatedAtByMember: null, fetchedAt: new Date(), message: result.message || '', loading: false });
    } else {
      // 서버가 JSON 이 아닌 응답을 주면 message 가 'ok' 로 남는다 — 사용자에게는 뜻이 통하는 문구로 바꾼다
      const message = result.message && result.message !== 'ok' ? result.message : '응답 형식이 올바르지 않아요';
      setState((s) => ({ ...s, status: 'error', message, loading: false }));
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      requestRef.current += 1;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  return { ...state, refresh };
}
