import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listPendingApprovalsFromBrowser,
  readJournalPeriodFromUrl,
  summarizePendingApprovals,
} from '../utils/kpiReportData';
import { splitWaivedApprovalItems } from '../constants/kpiApprovalPolicy';

/** 팀장 툴바·사이드바 승인 대기 뱃지 (localStorage 기준) */
export function useLeaderKpiPendingBadge(enabled) {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;
    const onStorage = (event) => {
      if (
        !event.key ||
        event.key.includes('journal') ||
        event.key.includes('kpi-operational') ||
        event.key.includes('improve-projects')
      ) {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    const intervalId = window.setInterval(refresh, 20000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
      window.clearInterval(intervalId);
    };
  }, [enabled, refresh]);

  return useMemo(() => {
    if (!enabled) {
      return { count: 0, summary: { total: 0, kpi1: 0, kpi2: 0, kpi3: 0 }, items: [], period: readJournalPeriodFromUrl() };
    }
    const period = readJournalPeriodFromUrl();
    // 승인 생략(구두 승인 간주) 건은 대기 배지에서 뺀다 — 처리할 일이 아니다
    const { actionable: items } = splitWaivedApprovalItems(listPendingApprovalsFromBrowser(period));
    return {
      count: items.length,
      summary: summarizePendingApprovals(items),
      items,
      period,
    };
  }, [enabled, tick]);
}
