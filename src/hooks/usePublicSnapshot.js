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
  const [warning, setWarning] = useState(null);
  const [snapshotEmpty, setSnapshotEmpty] = useState(false);
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
        setWarning(null);
        setSnapshotEmpty(false);
      }

      return fetchPublicSnapshot()
        .then((next) => {
          setData(next);
          setSnapshotEmpty(next === null);
          setError(null);
          setWarning(null);
          if (reloadCooldownMs > 0) {
            setCooldownUntil(Date.now() + reloadCooldownMs);
          }
        })
        .catch((err) => {
          const status = err?.status;
          const body = err?.body || {};
          setSnapshotEmpty(false);
          if (err?.isWarning || status === 401 || status === 403) {
            if (!quiet) setWarning(err.message || '클라우드 장부 조회 접근이 제한되었습니다.');
            setError(null);
            setData(null);
            return;
          }
          if (status) recordCloudFailure(status, body);
          setWarning(null);
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
    warning,
    snapshotEmpty,
    data,
    reload,
    reloadCooldownMs,
    reloadBlockedByCooldown: refreshing || reloadBlockedByCooldown,
  };
}
