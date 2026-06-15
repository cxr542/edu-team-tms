import React from 'react';
import { ExternalLink } from 'lucide-react';
import { buildAppModuleUrl } from '../hooks/useAppModule';
import {
  openAppModuleInNewTab,
  shouldAllowNativeModuleNavigation,
} from '../utils/appModuleNavigation';

/**
 * 사이드바 메뉴 — 일반 클릭은 SPA 전환, Ctrl/⌘+클릭·새 탭 버튼은 별도 탭
 */
export default function AppModuleNavItem({
  module,
  label,
  icon: Icon,
  isActive = false,
  isViewer = false,
  badgeCount = 0,
  tooltipProps = {},
  onNavigate,
}) {
  const href = buildAppModuleUrl(module, { mode: isViewer ? 'view' : undefined });

  return (
    <div className="project-nav-item-wrap">
      <a
        href={href}
        className={`nav-item project-nav-item${isActive ? ' is-active' : ''}`}
        onClick={(event) => {
          if (shouldAllowNativeModuleNavigation(event)) return;
          event.preventDefault();
          onNavigate?.(module);
        }}
        {...tooltipProps}
      >
        <Icon size={18} className="nav-item__icon project-nav-item__icon" aria-hidden />
        <span className="nav-item__label project-nav-item__label">{label}</span>
        {badgeCount > 0 ? (
          <span className="project-nav-item__badge" aria-hidden>
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </a>
      <button
        type="button"
        className="project-nav-item__new-tab"
        aria-label={`${label} 새 탭에서 열기`}
        title="새 탭에서 열기"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openAppModuleInNewTab(href);
        }}
      >
        <ExternalLink size={13} aria-hidden />
      </button>
    </div>
  );
}
