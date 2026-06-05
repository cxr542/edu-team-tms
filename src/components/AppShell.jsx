import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronDown,
  Presentation,
  CheckCircle,
  Eye,
  FileSpreadsheet,
  Home,
  Pencil,
  PieChart,
  Settings,
  Smartphone,
  Type,
  Lightbulb,
  UtensilsCrossed,
  MessageCircle,
} from 'lucide-react';
import { formatKpiMemberLabel, findKpiMember } from '../constants/kpiMembers';
import {
  NAV_GROUP_COMMON,
  NAV_GROUP_EXPERIMENTAL,
  NAV_GROUP_LEADER_WORK,
  NAV_GROUP_MEMBER_WORK,
  NAV_GROUP_TEAM_COMMON,
  NAV_GROUP_VIEWER,
  NAV_GROUP_VIEWER_KPI,
} from '../constants/teamAccess';
import { isModuleVisibleInViewer } from '../constants/viewerMenu';
import {
  formatAppVersion,
  getEnvironmentBannerMeta,
  getEnvironmentLabel,
  getProductionAppUrl,
  isProductionEnvironment,
} from '../constants/appEnv';
import { isEditorMode } from '../utils/appMode';
import { useFontSizePreference } from '../hooks/useFontSizePreference';
import { useProjectSidebar } from '../hooks/useProjectSidebar';
import { uiTooltip } from '../utils/uiTooltip';
import NavLabelsModal from './NavLabelsModal';
import MobileHomeGuideModal from './MobileHomeGuideModal';

import { getWorkspaceUrl } from '../constants/workspaceUrl';

export default function AppShell({
  activeModule,
  onModuleChange,
  navLabels,
  navDefaults,
  onNavLabelSave,
  onNavLabelsReset,
  isViewer,
  viewerMenuVisibility = null,
  onOpenViewerMenuSettings,
  sidebarFooter = null,
  teamAccess = null,
  children,
}) {
  const [navLabelsOpen, setNavLabelsOpen] = useState(false);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { fontSizeId, setFontSizeId, options: fontSizeOptions } = useFontSizePreference();
  const canEditNav = isEditorMode();
  const { collapsed, drawerOpen, toggleSidebar, closeDrawer, onNavSelect } = useProjectSidebar();

  const isProd = isProductionEnvironment();
  const envLabel = getEnvironmentLabel();
  const versionLabel = formatAppVersion();
  const banner = useMemo(() => getEnvironmentBannerMeta({ isViewer }), [isViewer]);

  useEffect(() => {
    document.title = `교육팀 TMS ${versionLabel} · ${envLabel}`;
    document.documentElement.dataset.tmsEnv = isProd ? 'production' : 'development';
    document.documentElement.dataset.tmsVersion = versionLabel.replace(/^v/, '');
  }, [envLabel, isProd, versionLabel]);

  const navTooltipProps = (label) =>
    collapsed
      ? { 'data-nav-tooltip': label, title: label, 'aria-label': label }
      : uiTooltip(label);

  const showInViewer = (module) =>
    !isViewer || (viewerMenuVisibility && isModuleVisibleInViewer(module, viewerMenuVisibility));

  const canShowEditModule = (module) => {
    if (isViewer) return showInViewer(module);
    if (!teamAccess) return true;
    return teamAccess.canAccessModule(module);
  };

  const showMemberWorkNav = !isViewer && (!teamAccess || teamAccess.isLeader || teamAccess.isMemberScope);
  const showTeamCommonNav = !isViewer && teamAccess?.isMemberScope;
  const showLeaderNav = !isViewer && (!teamAccess || teamAccess.isLeader);
  const showGeneralNav = !isViewer && (!teamAccess || teamAccess.isLeader);
  const showExperimentalNav = !isViewer && (!teamAccess || teamAccess.isLeader);

  const navBtn = (module, Icon, { viewer = false } = {}) => {
    const visible = viewer ? showInViewer(module) : canShowEditModule(module);
    if (!visible) return null;
    const label = navLabels[module];
    return (
      <button
        type="button"
        className={`nav-item project-nav-item${activeModule === module ? ' is-active' : ''}`}
        onClick={() => {
          onModuleChange(module);
          onNavSelect();
        }}
        {...navTooltipProps(label)}
      >
        <Icon size={18} className="nav-item__icon project-nav-item__icon" aria-hidden />
        <span className="nav-item__label project-nav-item__label">{label}</span>
      </button>
    );
  };

  const NavGroup = ({ title, children, className = '' }) => {
    const items = React.Children.toArray(children).filter(Boolean);
    if (!items.length) return null;
    return (
      <div className={`project-nav-group${className ? ` ${className}` : ''}`}>
        <p className="project-nav-group__title" aria-hidden={collapsed}>
          {title}
        </p>
        <div className="project-nav-group__items">{items}</div>
      </div>
    );
  };

  const viewerLedgerOnly =
    isViewer &&
    viewerMenuVisibility &&
    !viewerMenuVisibility.lunch &&
    !viewerMenuVisibility['idea-bank'] &&
    !viewerMenuVisibility['kpi-report'] &&
    !viewerMenuVisibility['kpi-approve'] &&
    !viewerMenuVisibility.docs;

  const railLabel = collapsed ? '펼침' : '접기';
  const railTitle = collapsed ? '메뉴 펼치기' : '메뉴 접기';
  const workspaceUrl = getWorkspaceUrl();

  return (
    <div
      className={`project-app theme-tms${isProd ? ' is-prod-env' : ' is-dev-env'}${viewerLedgerOnly ? ' is-viewer-ledger-only' : ''}`}
    >
      <p className="app-banner">
        <span className="app-banner__brand">
          교육팀 TMS
          <span className="app-version-badge">{versionLabel}</span>
          <span className={`app-env-badge app-env-badge--${isProd ? 'prod' : 'dev'}`}>{envLabel}</span>
        </span>
        <span className="app-banner__tagline">
          {isViewer ? '교육팀 팀 빌딩비 장부' : '팀 빌딩비·주간 업무 일지'}
        </span>
        <span className="app-banner__meta">{banner.meta}</span>
      </p>

      <div
        className="project-nav-backdrop"
        hidden={!drawerOpen}
        aria-hidden={!drawerOpen}
        onClick={closeDrawer}
      />

      <div
        className={`app-shell project-shell${collapsed ? ' is-sidebar-collapsed' : ''}`}
        id="app-shell"
      >
        <aside className="sidebar project-sidebar" id="sidebar" aria-label="서비스 메뉴">
          <div className="sidebar__head project-sidebar__head">
            <div className="logo-block project-logo">
              <h1>
                <span className="logo-block__icon project-logo__mark" aria-hidden="true">
                  <img src="/okestro-logo-white.png" alt="" />
                </span>
                <span className="logo-block__text project-logo__text">TMS</span>
              </h1>
              <p className="logo-block__sub project-logo__sub">
                교육팀 관리 · {versionLabel}
              </p>
            </div>
          </div>

          {!viewerLedgerOnly && (
            <nav className="sidebar-nav project-sidebar-nav" aria-label="주 메뉴">
              {isViewer ? (
                <>
                  <NavGroup title={NAV_GROUP_VIEWER}>
                    {navBtn('ledger', FileSpreadsheet, { viewer: true })}
                    {navBtn('lunch', UtensilsCrossed, { viewer: true })}
                    {navBtn('idea-bank', Lightbulb, { viewer: true })}
                  </NavGroup>
                  <NavGroup title={NAV_GROUP_VIEWER_KPI} className="project-nav-group--leader">
                    {navBtn('kpi-report', PieChart, { viewer: true })}
                    {navBtn('kpi-approve', CheckCircle, { viewer: true })}
                  </NavGroup>
                </>
              ) : (
                <>
                  {showGeneralNav && (
                    <NavGroup title={NAV_GROUP_COMMON}>
                      {navBtn('ledger', FileSpreadsheet)}
                      {navBtn('academizer', Presentation)}
                      {navBtn('lunch', UtensilsCrossed)}
                    </NavGroup>
                  )}
                  {showTeamCommonNav && (
                    <NavGroup title={NAV_GROUP_TEAM_COMMON}>
                      {navBtn('ledger', FileSpreadsheet)}
                      {navBtn('lunch', UtensilsCrossed)}
                      {navBtn('idea-bank', Lightbulb)}
                    </NavGroup>
                  )}
                  {showMemberWorkNav && (
                    <NavGroup title={NAV_GROUP_MEMBER_WORK}>
                      {navBtn('journal', Calendar)}
                      {navBtn('competency', Award)}
                    </NavGroup>
                  )}
                  {showExperimentalNav && (
                    <NavGroup title={NAV_GROUP_EXPERIMENTAL} className="project-nav-group--experimental">
                      {navBtn('cloud-chatbot', MessageCircle)}
                    </NavGroup>
                  )}
                  {showLeaderNav && (
                    <NavGroup title={NAV_GROUP_LEADER_WORK} className="project-nav-group--leader">
                      {navBtn('kpi', BarChart3)}
                      {navBtn('kpi-report', PieChart)}
                      {navBtn('kpi-approve', CheckCircle)}
                    </NavGroup>
                  )}
                </>
              )}
            </nav>
          )}

          {!viewerLedgerOnly && (showGeneralNav || isViewer) && (
            <nav className="sidebar-nav sidebar-nav--footer project-sidebar-nav-footer" aria-label="도구·참고">
              {showGeneralNav && navBtn('idea-bank', Lightbulb)}
              {(showGeneralNav || isViewer) && navBtn('docs', BookOpen, isViewer ? { viewer: true } : undefined)}
            </nav>
          )}

          <div className="project-sidebar-bottom">
            <div className="project-settings-menu">
              <button
                type="button"
                className={`nav-item project-nav-item project-nav-item--utility project-settings-trigger${settingsOpen ? ' is-open' : ''}`}
                onClick={() => setSettingsOpen((open) => !open)}
                {...navTooltipProps('설정')}
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
              >
                <Settings size={16} className="nav-item__icon project-nav-item__icon" aria-hidden />
                <span className="nav-item__label project-nav-item__label">설정</span>
                <ChevronDown
                  size={14}
                  className="project-settings-trigger__caret"
                  aria-hidden
                />
              </button>
              {settingsOpen && (
                <div className="project-settings-popover" role="menu" aria-label="설정 메뉴">
                  {canEditNav && (
                    <>
                      <button
                        type="button"
                        className="project-settings-popover__item"
                        onClick={() => {
                          setSettingsOpen(false);
                          setTimeout(() => onOpenViewerMenuSettings?.(), 0);
                          onNavSelect();
                        }}
                      >
                        <Eye size={14} aria-hidden />
                        조회 화면 메뉴
                      </button>
                      <button
                        type="button"
                        className="project-settings-popover__item"
                        onClick={() => {
                          setSettingsOpen(false);
                          setNavLabelsOpen(true);
                          onNavSelect();
                        }}
                      >
                        <Pencil size={14} aria-hidden />
                        메뉴 이름 변경
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="project-settings-popover__item"
                    onClick={() => {
                      setSettingsOpen(false);
                      setMobileGuideOpen(true);
                      onNavSelect();
                    }}
                  >
                    <Smartphone size={14} aria-hidden />
                    홈 화면에 추가
                  </button>
                  <div className="project-settings-popover__section" role="group" aria-label="글자 크기">
                    <p className="project-settings-popover__section-title">
                      <Type size={14} aria-hidden />
                      글자 크기
                    </p>
                    <div className="project-font-size-options">
                      {fontSizeOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`project-font-size-option${fontSizeId === opt.id ? ' is-active' : ''}`}
                          aria-pressed={fontSizeId === opt.id}
                          onClick={() => setFontSizeId(opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <a
              className="nav-item nav-item--hub project-nav-item project-nav-item--hub"
              href={workspaceUrl}
              {...navTooltipProps('Workspace로 돌아가기')}
            >
              <Home size={18} className="nav-item__icon project-nav-item__icon" aria-hidden />
              <span className="nav-item__label project-nav-item__label">← Workspace</span>
            </a>

            <p className="sidebar-note project-sidebar-note">
              {isViewer ? (
                <>👀 교육팀 조회 · 팀 빌딩비 장부</>
              ) : teamAccess?.isMemberScope ? (
                <>👤 팀원 · 일지·역량·팀 공통</>
              ) : (
                <>✏️ 교육팀 총무 · 장부·일지 작성</>
              )}
              {!isProd && (
                <>
                  <br />
                  <span className="sidebar-note__dev">{banner.devWarning}</span>
                </>
              )}
            </p>

            {sidebarFooter}
          </div>

          <button
            type="button"
            className="sidebar-rail project-sidebar-rail"
            id="sidebar-toggle"
            aria-expanded={!collapsed}
            aria-controls="sidebar"
            aria-label={railTitle}
            data-ui-tooltip={railTitle}
            title={railTitle}
            onClick={toggleSidebar}
          >
            <span className="sidebar-rail__label project-sidebar-rail__label">{railLabel}</span>
            <span className="sidebar-rail__icon project-sidebar-rail__icon" aria-hidden="true">
              ‹
            </span>
          </button>
        </aside>

        <div className="main project-main">
          <div className="toolbar project-toolbar">
            <button
              type="button"
              className="btn btn-secondary project-nav-toggle"
              id="sidebar-toggle-toolbar"
              aria-expanded={drawerOpen}
              aria-controls="sidebar"
              {...uiTooltip('사이드바 메뉴 열기·닫기', 'below')}
              onClick={toggleSidebar}
            >
              ☰
            </button>
            <a
              className="btn btn--hub"
              href={workspaceUrl}
              {...uiTooltip('cxr542 Workspace 랜딩', 'below')}
            >
              ← Workspace
            </a>
            {!isProd && (
              <a
                className="btn btn--prod-link"
                href={getProductionAppUrl(isViewer ? 'view' : 'edit')}
                {...uiTooltip('운영 URL 새 탭', 'below')}
              >
                운영 URL
              </a>
            )}
            <p className="project-toolbar__title">
              {navLabels[activeModule]}
              <span className="project-toolbar__env">{envLabel}</span>
              {teamAccess?.isMemberScope && teamAccess.scopedMember && (
                <span className="project-toolbar__scope">
                  {formatKpiMemberLabel(findKpiMember(teamAccess.scopedMember))}
                </span>
              )}
              {teamAccess?.isLeader && !teamAccess.isMemberScope && (
                <span className="project-toolbar__scope project-toolbar__scope--leader">팀장</span>
              )}
            </p>
          </div>
          <div className="content project-content">{children}</div>
        </div>
      </div>

      <NavLabelsModal
        isOpen={navLabelsOpen}
        onClose={() => setNavLabelsOpen(false)}
        labels={navLabels}
        defaults={navDefaults}
        onSave={onNavLabelSave}
        onReset={() => {
          onNavLabelsReset();
          setNavLabelsOpen(false);
        }}
      />

      <MobileHomeGuideModal
        isOpen={mobileGuideOpen}
        onClose={() => setMobileGuideOpen(false)}
        isViewer={isViewer}
      />
    </div>
  );
}
