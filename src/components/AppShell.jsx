import React, { useState } from 'react';
import { Calendar, FileSpreadsheet, Pencil, Smartphone } from 'lucide-react';
import { isEditorMode } from '../utils/appMode';
import NavLabelsModal from './NavLabelsModal';
import MobileHomeGuideModal from './MobileHomeGuideModal';

export default function AppShell({
  activeModule,
  onModuleChange,
  navLabels,
  navDefaults,
  onNavLabelSave,
  onNavLabelsReset,
  isViewer,
  ledgerSidebar = null,
  children,
}) {
  const [navLabelsOpen, setNavLabelsOpen] = useState(false);
  const [mobileGuideOpen, setMobileGuideOpen] = useState(false);
  const canEditNav = isEditorMode();

  const navBtn = (module, Icon, iconColor) => (
    <button
      type="button"
      className={`nav-item nav-item-btn${activeModule === module ? ' active' : ''}`}
      onClick={() => onModuleChange(module)}
    >
      <Icon size={18} style={{ color: iconColor }} />
      {navLabels[module]}
    </button>
  );

  return (
    <>
      <aside className="sidebar" style={{ borderRight: '1px solid rgba(16, 185, 129, 0.08)' }}>
        <div className="logo-container">
          <div className="logo-mark">
            <img src="/okestro-logo-white.png" alt="OKESTRO" className="logo-okestro" />
          </div>
          <div className="logo-divider" aria-hidden="true" />
          <div className="logo-text">
            <h2 className="logo-title">
              <span className="logo-team-label">교육팀</span>
              <span className="logo-brand">TMS</span>
            </h2>
          </div>
        </div>

        <nav className="nav-menu">
          {navBtn('ledger', FileSpreadsheet, '#10b981')}
          {!isViewer && navBtn('journal', Calendar, activeModule === 'journal' ? '#10b981' : '#0ea5e9')}
        </nav>

        {activeModule === 'ledger' && ledgerSidebar}

        {canEditNav && (
          <button
            type="button"
            className="btn btn-secondary nav-labels-edit"
            onClick={() => setNavLabelsOpen(true)}
          >
            <Pencil size={14} />
            메뉴 이름 변경
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary mobile-home-guide-btn"
          onClick={() => setMobileGuideOpen(true)}
        >
          <Smartphone size={14} />
          홈 화면에 추가
        </button>

        <div
          className="user-profile-section"
          style={{ borderTop: '1px solid rgba(16, 185, 129, 0.08)', marginTop: 'auto' }}
        >
          <div className="user-avatar" style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)' }}>
            EDU
          </div>
          <div className="user-details">
            <h4>{isViewer ? '교육팀 조회' : '교육팀 총무'}</h4>
            <p>{isViewer ? '팀 빌딩비 열람' : '작성 모드'}</p>
          </div>
        </div>
      </aside>

      {children}

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
    </>
  );
}
