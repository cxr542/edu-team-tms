import { useEffect, useRef, useState } from 'react';
import { buildTeamSnapshot, publishSnapshotToServer } from '../utils/publishSnapshot';

/**
 * 작성(관리자) 장부 변경 시 조회용 Blob에 자동 게시 (debounce)
 */
export function useAutoPublishLedger({ enabled, transactions, categories, onSuccess, onFail }) {
  const [publishing, setPublishing] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState(null);
  const [liveReady, setLiveReady] = useState(false);
  const skipFirst = useRef(true);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setPublishing(true);
      try {
        const payload = buildTeamSnapshot(transactions, categories);
        const result = await publishSnapshotToServer(payload);
        if (result.ok) {
          setLiveReady(true);
          setLastPublishedAt(result.publishedAt || payload.publishedAt);
          onSuccess?.(payload);
        } else if (result.reason !== 'not-configured' && result.reason !== 'not-allowed') {
          onFail?.(result);
        }
      } finally {
        inFlightRef.current = false;
        setPublishing(false);
      }
    }, 900);

    return () => clearTimeout(timerRef.current);
  }, [enabled, transactions, categories, onSuccess, onFail]);

  const publishNow = async () => {
    const payload = buildTeamSnapshot(transactions, categories);
    setPublishing(true);
    try {
      const result = await publishSnapshotToServer(payload);
      if (result.ok) {
        setLiveReady(true);
        setLastPublishedAt(result.publishedAt || payload.publishedAt);
        onSuccess?.(payload);
        return result;
      }
      onFail?.(result);
      return result;
    } finally {
      setPublishing(false);
    }
  };

  return { publishing, lastPublishedAt, liveReady, publishNow };
}
