import { useCallback, useEffect, useState } from 'react';

function readPeriodFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const now = new Date();
  const y = parseInt(params.get('year'), 10);
  const m = parseInt(params.get('month'), 10);
  return {
    year: Number.isFinite(y) ? y : now.getFullYear(),
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth(),
  };
}

export function useJournalPeriod() {
  const initial = readPeriodFromUrl();
  const [year, setYearState] = useState(initial.year);
  const [month, setMonthState] = useState(initial.month);

  const syncUrl = useCallback((y, m) => {
    const url = new URL(window.location.href);
    url.searchParams.set('year', String(y));
    url.searchParams.set('month', String(m + 1));
    window.history.replaceState({}, '', url);
  }, []);

  const setYear = useCallback(
    (y) => {
      setYearState(y);
      syncUrl(y, month);
    },
    [month, syncUrl]
  );

  const setMonth = useCallback(
    (m) => {
      setMonthState(m);
      syncUrl(year, m);
    },
    [year, syncUrl]
  );

  const setPeriod = useCallback(
    (y, m) => {
      setYearState(y);
      setMonthState(m);
      syncUrl(y, m);
    },
    [syncUrl]
  );

  useEffect(() => {
    const onPop = () => {
      const next = readPeriodFromUrl();
      setYearState(next.year);
      setMonthState(next.month);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    syncUrl(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeMonth = useCallback(
    (delta) => {
      let m = month + delta;
      let y = year;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      setPeriod(y, m);
    },
    [month, year, setPeriod]
  );

  return { year, month, setYear, setMonth, setPeriod, changeMonth };
}
