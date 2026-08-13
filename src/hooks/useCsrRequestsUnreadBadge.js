import { useCallback, useEffect, useState } from 'react';
import {
  listCsrRequestsFromSupabase,
  normalizeCsrRequest,
} from '../utils/csrRequestsSupabase.js';
import { countReceivedCsrRequests, extractReceivedCsrRequests } from '../utils/csrRequestsUnreadBadge.js';

const REFRESH_MS = 30000;

/** 관리자 사이드바 「이것도」 접수(received) 큐 배지 */
export function useCsrRequestsUnreadBadge(enabled) {
  const [state, setState] = useState({ count: 0, items: [] });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ count: 0, items: [] });
      return;
    }

    const result = await listCsrRequestsFromSupabase({});
    if (!result.ok && result.status !== 'empty') {
      setState({ count: 0, items: [] });
      return;
    }

    const items = Array.isArray(result.data)
      ? result.data.map(normalizeCsrRequest).filter(Boolean)
      : [];
    const receivedItems = extractReceivedCsrRequests(items);
    setState({ count: receivedItems.length, items: receivedItems });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setState({ count: 0, items: [] });
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

  return state;
}
