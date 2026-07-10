import { useCallback, useEffect, useRef, useState } from 'react';
import { JOURNAL_SUPABASE_FRESHNESS_POLL_MS } from '../constants/supabaseSync';
import {
  JOURNAL_FRESHNESS_STATUS,
  buildJournalFreshnessState,
} from '../utils/journalSupabaseFreshness';
import { getJournalSnapshotFromSupabase } from '../utils/supabaseJournalSnapshot';

const IDLE_FRESHNESS = {
  status: JOURNAL_FRESHNESS_STATUS.idle,
  remoteUpdatedAt: null,
  message: '',
};

/**
 * J7a: poll journal_snapshots freshness for Preview mirror tools.
 * Does not auto-import remote into local — UI label only.
 *
 * @param {{
 *   enabled: boolean,
 *   memberCode: string,
 *   localUpdatedAt?: string|null,
 *   pollMs?: number,
 * }} options
 */
export function useJournalSupabaseFreshness({
  enabled,
  memberCode,
  localUpdatedAt = null,
  pollMs = JOURNAL_SUPABASE_FRESHNESS_POLL_MS,
} = {}) {
  const [freshness, setFreshness] = useState(IDLE_FRESHNESS);
  const requestIdRef = useRef(0);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) {
        setFreshness(IDLE_FRESHNESS);
        return IDLE_FRESHNESS;
      }

      const code = String(memberCode || '').trim();
      if (!code) {
        setFreshness(IDLE_FRESHNESS);
        return IDLE_FRESHNESS;
      }

      const requestId = ++requestIdRef.current;
      if (!silent) {
        setFreshness((prev) => ({
          ...prev,
          status: JOURNAL_FRESHNESS_STATUS.loading,
          message: '',
        }));
      }

      const result = await getJournalSnapshotFromSupabase(code);
      if (requestId !== requestIdRef.current) return null;

      const next = buildJournalFreshnessState(result, localUpdatedAt);
      setFreshness(next);
      return next;
    },
    [enabled, memberCode, localUpdatedAt]
  );

  useEffect(() => {
    if (!enabled) {
      setFreshness(IDLE_FRESHNESS);
      return undefined;
    }

    void refresh({ silent: false });

    const onFocus = () => {
      void refresh({ silent: true });
    };
    window.addEventListener('focus', onFocus);

    const intervalId = window.setInterval(() => {
      void refresh({ silent: true });
    }, pollMs);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
      requestIdRef.current += 1;
    };
  }, [enabled, memberCode, pollMs, refresh]);

  return { freshness, setFreshness, refresh };
}
