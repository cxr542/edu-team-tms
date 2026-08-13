import React, { useState, useRef, useEffect } from 'react';
import { Bell, ArrowRight } from 'lucide-react';
import { URL_ACCESS_ADMIN } from '../constants/teamAccess';
import { buildAppModuleUrl } from '../hooks/useAppModule';
import { uiTooltip } from '../utils/uiTooltip';

export default function LeaderKpiApprovalBell({ count = 0, summary, period, items = [], className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const href = buildAppModuleUrl('kpi-approve', {
    access: URL_ACCESS_ADMIN,
    year: period?.year,
    month: (period?.monthIndex ?? 0) + 1,
  });

  const label =
    count > 0
      ? `KPI 승인 대기 ${count}건 (KPI1 ${summary?.kpi1 ?? 0} · KPI2 ${summary?.kpi2 ?? 0} · KPI3 ${summary?.kpi3 ?? 0})`
      : 'KPI 승인 대기 없음';

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (e) => {
    e.preventDefault();
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`leader-kpi-approval-bell-container ${className}`.trim()} ref={containerRef}>
      <button
        type="button"
        className={`leader-kpi-approval-bell${count > 0 ? ' has-pending' : ''}`}
        aria-label={label}
        onClick={handleToggle}
        {...(!isOpen ? uiTooltip(label, 'below', { wrap: true }) : {})}
      >
        <Bell size={18} aria-hidden />
        {count > 0 ? <span className="leader-kpi-approval-bell__badge">{count > 99 ? '99+' : count}</span> : null}
      </button>

      {isOpen && (
        <div className="leader-kpi-approval-popover">
          <div className="leader-kpi-approval-popover__header">
            <h4>승인 대기 알림</h4>
            <span className="leader-kpi-approval-popover__count">{count}건</span>
          </div>
          <div className="leader-kpi-approval-popover__body">
            {items.length > 0 ? (
              <ul className="leader-kpi-approval-popover__list">
                {items.map((item, idx) => {
                  const itemHref = buildAppModuleUrl('kpi-approve', {
                    access: URL_ACCESS_ADMIN,
                    year: item.year ?? period?.year,
                    month: (item.monthIndex ?? period?.monthIndex ?? 0) + 1,
                  });
                  return (
                  <li key={`${item.type}-${item.member.code}-${item.dayKey || idx}`}>
                    <a href={itemHref} className="leader-kpi-approval-popover__item">
                      <div className="leader-kpi-approval-popover__item-title">
                        <span className="leader-kpi-approval-popover__item-badge">{item.type}</span>
                        {item.label}
                      </div>
                      {item.submittedAt && (
                        <div className="leader-kpi-approval-popover__item-time">
                          {new Date(item.submittedAt).toLocaleString()}
                        </div>
                      )}
                    </a>
                  </li>
                  );
                })}
              </ul>
            ) : (
              <div className="leader-kpi-approval-popover__empty">새로운 승인 요청이 없습니다.</div>
            )}
          </div>
          <div className="leader-kpi-approval-popover__footer">
            <a href={href} className="leader-kpi-approval-popover__view-all" onClick={() => setIsOpen(false)}>
              전체 승인 관리 이동 <ArrowRight size={14} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

