import { useCallback, useEffect, useState } from 'react';
import { fetchPublicSnapshot } from '../utils/publishSnapshot';

export function usePublicSnapshot(enabled, { pollMs = 0, silentPoll = true } = {}) {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const reload = useCallback(
    ({ quiet = false } = {}) => {
      if (!enabled) return;
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      fetchPublicSnapshot()
        .then(setData)
        .catch((err) => {
          if (!quiet) setError(err.message || '불러오기 실패');
        })
        .finally(() => {
          if (!quiet) setLoading(false);
        });
    },
    [enabled]
  );

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  useEffect(() => {
    if (!enabled || !pollMs) return;
    const id = setInterval(() => reload({ quiet: silentPoll }), pollMs);
    return () => clearInterval(id);
  }, [enabled, pollMs, silentPoll, reload]);

  return { loading, error, data, reload };
}
