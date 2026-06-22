import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronDown,
  ExternalLink,
  Presentation,
  CheckCircle,
  Eye,
  FileSpreadsheet,
  Pencil,
  PieChart,
  Settings,
  Smartphone,
  Type,
  Lightbulb,
  UtensilsCrossed,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import LeaderKpiApprovalBell from './LeaderKpiApprovalBell';
import { useLeaderKpiPendingBadge } from '../hooks/useLeaderKpiPendingBadge';
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
  getDevelopmentAppUrl,
  getEnvironmentBannerMeta,
  getEnvironmentLabel,
  getProductionAppUrl,
  canShowLeaderDevUrlLink,
  isProductionEnvironment,
} from '../constants/appEnv';
import { isEditorMode } from '../utils/appMode';
import { useFontSizePreference } from '../hooks/useFontSizePreference';
import { useProjectSidebar } from '../hooks/useProjectSidebar';
import { uiTooltip } from '../utils/uiTooltip';
import NavLabelsModal from './NavLabelsModal';
import MobileHomeGuideModal from './MobileHomeGuideModal';
import AppModuleNavItem from './AppModuleNavItem';
import { buildAppModuleUrl } from '../hooks/useAppModule';
import { openAppModuleInNewTab } from '../utils/appModuleNavigation';
import { withAppBase } from '../utils/appRoute';

export default function AppShell({
  activeModule,
  onModuleChange,
  navLabels,
  navDefaults,
  onNavLabelSave,
  onNavLabelsReset,
  isViewer,
  isPublicViewerScope = false,
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
  const showLeaderDevUrlLink = canShowLeaderDevUrlLink({
    isViewer,
    isPublicViewerScope,
    teamAccess,
  });
  const devUrlTooltip = isProd
    ? '로컬 개발 URL 새 탭 (localhost:3000)'
    : '팀장 dev URL (배포 후 운영 화면 툴바에도 표시)';
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
    if (!teamAccess) return false;
    return teamAccess.canAccessModule(module);
  };

  const isAdminShell = Boolean(teamAccess?.isAdmin && !teamAccess?.isMemberScope);
  const isMemberShell = Boolean(teamAccess?.isMemberScope);

  const showMemberWorkNav = !isViewer && (isMemberShell || isAdminShell);
  const showTeamCommonNav = !isViewer && isMemberShell;
  const showLeaderNav = !isViewer && isAdminShell;
  const showGeneralNav = !isViewer && isAdminShell;
  const showExperimentalNav = !isViewer && isAdminShell;
  const showLeaderApprovalBadge = showLeaderNav && teamAccess?.isAdmin && !teamAccess?.isMemberScope;
  const leaderPending = useLeaderKpiPendingBadge(showLeaderApprovalBadge);
  const canUseCompetencyPilot = isAdminShell || !teamAccess?.isMemberScope || teamAccess?.scopedMember === 'A';
  const competencyPreviewMessage =
    '역량 평가는 기능 개선 중이라 아직 공개 전입니다. 먼저 A 구성원과 팀장/관리자 화면에서 테스트 후 순차 공개할 예정입니다.';

  const navBtn = (module, Icon, { viewer = false, badgeCount = 0 } = {}) => {
    const visible = viewer ? showInViewer(module) : canShowEditModule(module);
    if (!visible) return null;
    const label = navLabels[module];
    const itemViewer = viewer || isViewer;
    return (
      <AppModuleNavItem
        module={module}
        label={label}
        icon={Icon}
        isActive={activeModule === module}
        isViewer={itemViewer}
        badgeCount={badgeCount}
        tooltipProps={navTooltipProps(label)}
        onNavigate={(mod) => {
          onModuleChange(mod);
          onNavSelect();
        }}
      />
    );
  };

  const currentScreenHref = buildAppModuleUrl(activeModule, {
    mode: isViewer ? 'view' : undefined,
  });

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
    !isPublicViewerScope &&
    viewerMenuVisibility &&
    !viewerMenuVisibility.lunch &&
    !viewerMenuVisibility['idea-bank'] &&
    !viewerMenuVisibility['kpi-report'] &&
    !viewerMenuVisibility['kpi-approve'] &&
    !viewerMenuVisibility.docs;

  const railLabel = collapsed ? '펼침' : '접기';
  const railTitle = collapsed ? '메뉴 펼치기' : '메뉴 접기';
  return (
    <div
      className={`project-app theme-tms${isProd ? ' is-prod-env' : ' is-dev-env'}${viewerLedgerOnly ? ' is-viewer-ledger-only' : ''}${isPublicViewerScope ? ' is-public-viewer-guide' : ''}`}
    >
      <p className="app-banner">
        <span className="app-banner__brand">
          교육팀 TMS
          <span className="app-version-badge">{versionLabel}</span>
          <span className={`app-env-badge app-env-badge--${isProd ? 'prod' : 'dev'}`}>{envLabel}</span>
        </span>
        <span className="app-banner__tagline">
          {isPublicViewerScope
            ? '역할별 접속 URL 안내'
            : isViewer
              ? '교육팀 팀 빌딩비 장부'
              : '팀 빌딩비·주간 업무 일지'}
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
                <span className="logo-block__text project-logo__text">EDU-TMS</span>
              </h1>
              <p className="logo-block__sub project-logo__sub">
                교육팀 관리 · {versionLabel}
              </p>
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
              <span className="sidebar-rail__icon project-sidebar-rail__icon" aria-hidden="true">
                ‹
              </span>
              <span className="sidebar-rail__label project-sidebar-rail__label">{railLabel}</span>
            </button>
          </div>

          {!viewerLedgerOnly && !isPublicViewerScope && (
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
                      {canUseCompetencyPilot ? (
                        navBtn('competency', Award)
                      ) : (
                        <button
                          type="button"
                          className="project-nav-item project-nav-item--disabled-preview"
                          aria-disabled="true"
                          title={competencyPreviewMessage}
                          onClick={() => {
                            window.alert(competencyPreviewMessage);
                            onNavSelect();
                          }}
                        >
                          <Award size={18} aria-hidden />
                          <span>{navLabels.competency || '역량 평가'}</span>
                        </button>
                      )}
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
                      {navBtn('kpi-approve', CheckCircle, { badgeCount: leaderPending.count })}
                    </NavGroup>
                  )}
                </>
              )}
            </nav>
          )}

          {!viewerLedgerOnly && !isPublicViewerScope && (showGeneralNav || showTeamCommonNav || isMemberShell || isViewer) && (
            <nav className="sidebar-nav sidebar-nav--footer project-sidebar-nav-footer" aria-label="도구·참고">
              {isAdminShell && (
                <a
                  className="nav-item project-nav-item project-nav-item--hub"
                  href={withAppBase('/')}
                  onClick={onNavSelect}
                  {...navTooltipProps('접속 안내')}
                >
                  <Sparkles size={16} className="nav-item__icon project-nav-item__icon" aria-hidden />
                  <span className="nav-item__label project-nav-item__label">접속 안내</span>
                </a>
              )}
              {showGeneralNav && navBtn('idea-bank', Lightbulb)}
              {(canShowEditModule('docs') || (isViewer && showInViewer('docs'))) &&
                navBtn('docs', BookOpen, isViewer ? { viewer: true } : undefined)}
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
                  {canEditNav && isAdminShell && !isPublicViewerScope && (
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
                      openAppModuleInNewTab(currentScreenHref);
                      onNavSelect();
                    }}
                  >
                    <ExternalLink size={14} aria-hidden />
                    현재 화면 새 탭에서 열기
                  </button>
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

            <p className="sidebar-note project-sidebar-note">
              {isPublicViewerScope ? (
                <>📌 역할별 접속 안내 · 북마크 URL 선택</>
              ) : isViewer ? (
                <>👀 교육팀 조회 · 팀 빌딩비 장부</>
              ) : teamAccess?.isMemberScope ? (
                <>👤 사용자 · 일지·역량·팀 공통·참고문서</>
              ) : (
                <>⚙️ 관리자 · 장부·KPI·팀 일지</>
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
            {!isProd && (
              <a
                className="btn btn--prod-link"
                href={getProductionAppUrl(
                  isViewer ? 'view' : 'edit',
                  typeof window !== 'undefined' ? window.location.href : undefined
                )}
                {...uiTooltip('운영 URL 새 탭', 'below')}
              >
                운영 URL
              </a>
            )}
            {showLeaderDevUrlLink && (
              <a
                className="btn btn--dev-link"
                href={getDevelopmentAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                {...uiTooltip(devUrlTooltip, 'below')}
              >
                개발 URL
              </a>
            )}
            <p className="project-toolbar__title">
              {isPublicViewerScope ? '접속 안내' : navLabels[activeModule]}
              <span className="project-toolbar__env">{envLabel}</span>
              {teamAccess?.isMemberScope && teamAccess.scopedMember && (
                <span className="project-toolbar__scope">
                  {formatKpiMemberLabel(findKpiMember(teamAccess.scopedMember))}
                </span>
              )}
              {teamAccess?.isAdmin && !teamAccess.isMemberScope && (
                <span className="project-toolbar__scope project-toolbar__scope--leader">관리자</span>
              )}
            </p>
            {showLeaderApprovalBadge && (
              <LeaderKpiApprovalBell
                count={leaderPending.count}
                summary={leaderPending.summary}
                period={leaderPending.period}
              />
            )}
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
