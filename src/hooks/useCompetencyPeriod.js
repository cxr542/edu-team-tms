import { useCallback, useEffect, useState } from 'react';

/** monthIndex(0-based) → 분기 번호 1~4 */
export function quarterFromMonthIndex(monthIndex) {
  return Math.floor(monthIndex / 3) + 1;
}

/** 분기 번호 → 해당 분기 첫 달 monthIndex(0-based) */
export function firstMonthIndexOfQuarter(quarter) {
  return (quarter - 1) * 3;
}

/** year + quarter(1~4) → YYYY-nQ */
export function yqFromYearQuarter(year, quarter) {
  return `${year}-${quarter}Q`;
}

/** URL·입력에서 year/quarter 해석 — quarter 우선, 없으면 month에서 derive */
export function resolveCompetencyPeriod(params = {}, now = new Date()) {
  const yearRaw = parseInt(params.year, 10);
  const year = Number.isFinite(yearRaw) ? yearRaw : now.getFullYear();

  const quarterRaw = parseInt(params.quarter, 10);
  if (Number.isFinite(quarterRaw) && quarterRaw >= 1 && quarterRaw <= 4) {
    return { year, quarter: quarterRaw };
  }

  const monthRaw = parseInt(params.month, 10);
  if (Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12) {
    return { year, quarter: quarterFromMonthIndex(monthRaw - 1) };
  }

  return { year, quarter: quarterFromMonthIndex(now.getMonth()) };
}

export function readCompetencyPeriodFromUrl(search = window.location.search) {
  const params = Object.fromEntries(new URLSearchParams(search));
  return resolveCompetencyPeriod(params);
}

export function useCompetencyPeriod() {
  const initial = readCompetencyPeriodFromUrl();
  const [year, setYearState] = useState(initial.year);
  const [quarter, setQuarterState] = useState(initial.quarter);

  const monthIndex = firstMonthIndexOfQuarter(quarter);
  const yq = yqFromYearQuarter(year, quarter);

  const syncUrl = useCallback((y, q) => {
    const url = new URL(window.location.href);
    url.searchParams.set('year', String(y));
    url.searchParams.set('quarter', String(q));
    url.searchParams.delete('month');
    window.history.replaceState({}, '', url);
  }, []);

  const setPeriod = useCallback(
    (y, q) => {
      setYearState(y);
      setQuarterState(q);
      syncUrl(y, q);
    },
    [syncUrl]
  );

  const setYear = useCallback(
    (y) => {
      setYearState(y);
      syncUrl(y, quarter);
    },
    [quarter, syncUrl]
  );

  const setQuarter = useCallback(
    (q) => {
      setQuarterState(q);
      syncUrl(year, q);
    },
    [year, syncUrl]
  );

  const changeQuarter = useCallback(
    (delta) => {
      let q = quarter + delta;
      let y = year;
      if (q < 1) {
        q = 4;
        y -= 1;
      } else if (q > 4) {
        q = 1;
        y += 1;
      }
      setPeriod(y, q);
    },
    [quarter, year, setPeriod]
  );

  useEffect(() => {
    const onPop = () => {
      const next = readCompetencyPeriodFromUrl();
      setYearState(next.year);
      setQuarterState(next.quarter);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    syncUrl(year, quarter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    year,
    quarter,
    yq,
    monthIndex,
    setYear,
    setQuarter,
    setPeriod,
    changeQuarter,
  };
}
