import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPublicSnapshot } from '../utils/publishSnapshot';
import { recordCloudFailure, recordCloudSuccess } from '../utils/cloudHealth';

export function usePublicSnapshot(
  enabled,
  { pollMs = 0, silentPoll = true, reloadCooldownMs = 30000 } = {}
) {
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const inFlightRef = useRef(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const reload = useCallback(
    ({ quiet = false, force = false } = {}) => {
      if (!enabled) return Promise.resolve();
      if (inFlightRef.current) return Promise.resolve();

      const now = Date.now();
      if (!force && reloadCooldownMs > 0 && cooldownUntil > now) {
        return Promise.resolve();
      }

      inFlightRef.current = true;
      if (!quiet) {
        setRefreshing(true);
        setLoading(true);
        setError(null);
      }

      return fetchPublicSnapshot()
        .then((next) => {
          setData(next);
          if (reloadCooldownMs > 0) {
            setCooldownUntil(Date.now() + reloadCooldownMs);
          }
        })
        .catch((err) => {
          const status = err?.status;
          const body = err?.body || {};
          if (status) recordCloudFailure(status, body);
          if (!quiet) setError(err.message || '불러오기 실패');
        })
        .finally(() => {
          inFlightRef.current = false;
          if (!quiet) {
            setLoading(false);
            setRefreshing(false);
          }
        });
    },
    [enabled, reloadCooldownMs, cooldownUntil]
  );

  const reloadBlockedByCooldown = refreshing || (reloadCooldownMs > 0 && cooldownUntil > Date.now());

  useEffect(() => {
    if (enabled) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pollMs) return undefined;
    const id = setInterval(() => reload({ quiet: silentPoll }), pollMs);
    return () => clearInterval(id);
  }, [enabled, pollMs, silentPoll, reload]);

  return {
    loading,
    refreshing,
    error,
    data,
    reload,
    reloadCooldownMs,
    reloadBlockedByCooldown: refreshing || reloadBlockedByCooldown,
  };
}
