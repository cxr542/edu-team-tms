import React from 'react';
import { Bell } from 'lucide-react';
import { URL_ACCESS_ADMIN } from '../constants/teamAccess';
import { buildAppModuleUrl } from '../hooks/useAppModule';
import { uiTooltip } from '../utils/uiTooltip';

export default function LeaderKpiApprovalBell({ count = 0, summary, period, className = '' }) {
  const href = buildAppModuleUrl('kpi-approve', {
    access: URL_ACCESS_ADMIN,
    year: period?.year,
    month: (period?.monthIndex ?? 0) + 1,
  });
  const label =
    count > 0
      ? `KPI 승인 대기 ${count}건 (KPI1 ${summary?.kpi1 ?? 0} · KPI2 ${summary?.kpi2 ?? 0})`
      : 'KPI 승인 대기 없음';

  return (
    <a
      href={href}
      className={`leader-kpi-approval-bell${count > 0 ? ' has-pending' : ''} ${className}`.trim()}
      aria-label={label}
      {...uiTooltip(label, 'below', { wrap: true })}
    >
      <Bell size={18} aria-hidden />
      {count > 0 ? <span className="leader-kpi-approval-bell__badge">{count > 99 ? '99+' : count}</span> : null}
    </a>
  );
}
