import { useCallback, useEffect, useState } from 'react';
import {
  listCsrRequestsFromSupabase,
  normalizeCsrRequest,
} from '../utils/csrRequestsSupabase.js';
import { countReceivedCsrRequests } from '../utils/csrRequestsUnreadBadge.js';

const REFRESH_MS = 30000;

/** 관리자 사이드바 「이것도」 접수(received) 큐 배지 */
export function useCsrRequestsUnreadBadge(enabled) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }

    const result = await listCsrRequestsFromSupabase({});
    if (!result.ok && result.status !== 'empty') {
      setCount(0);
      return;
    }

    const items = Array.isArray(result.data)
      ? result.data.map(normalizeCsrRequest).filter(Boolean)
      : [];
    setCount(countReceivedCsrRequests(items));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return undefined;
    }

    void refresh();

    window.addEventListener('focus', refresh);
    const intervalId = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);

    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(intervalId);
    };
  }, [enabled, refresh]);

  return { count };
}
