import React from 'react';
import { ArrowRight, BookOpen, Bookmark, Sparkles } from 'lucide-react';
import AppModuleLink from '../components/AppModuleLink';
import {
  navigateToBookmarkReferenceDoc,
  PUBLIC_VIEWER_ROLE_PORTALS,
} from '../constants/publicViewerPortal';
import { formatKpiMemberLabel } from '../constants/kpiMembers';

function RolePortalCard({ portal }) {
  const { primary, links, member, badge, summary, accent } = portal;
  const { label: primaryLabel, ...primaryNav } = primary;

  return (
    <article className={`public-viewer-portal__card public-viewer-portal__card--${accent}`}>
      <header className="public-viewer-portal__card-head">
        <span className="public-viewer-portal__badge">{badge}</span>
        <h2 className="public-viewer-portal__card-title">{formatKpiMemberLabel(member)}</h2>
        <p className="public-viewer-portal__card-summary">{summary}</p>
      </header>

      <AppModuleLink className="btn btn-primary public-viewer-portal__primary" {...primaryNav}>
        {primaryLabel}
        <ArrowRight size={16} aria-hidden />
      </AppModuleLink>

      <div className="public-viewer-portal__quick">
        <p className="public-viewer-portal__quick-label">바로가기</p>
        <ul className="public-viewer-portal__quick-list">
          {links.map((link) => {
            const { label, ...linkNav } = link;
            return (
              <li key={`${portal.id}-${label}`}>
                <AppModuleLink className="public-viewer-portal__quick-link" {...linkNav}>
                  {label}
                </AppModuleLink>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

export default function PublicViewerGuidePage() {
  return (
    <main className="main-content public-viewer-portal">
      <header className="public-viewer-portal__hero">
        <div className="public-viewer-portal__hero-icon" aria-hidden>
          <Sparkles size={28} />
        </div>
        <h1 className="public-viewer-portal__title">교육팀 TMS 접속 안내</h1>
        <p className="public-viewer-portal__lead">
          로그인 없이 역할에 맞는 화면으로 이동합니다. 자주 쓰는 주소는 각 화면 URL을 북마크해 두세요.
        </p>
      </header>

      <div className="public-viewer-portal__grid">
        {PUBLIC_VIEWER_ROLE_PORTALS.map((portal) => (
          <RolePortalCard key={portal.id} portal={portal} />
        ))}
      </div>

      <footer className="public-viewer-portal__footer">
        <button
          type="button"
          className="public-viewer-portal__footer-link"
          onClick={navigateToBookmarkReferenceDoc}
        >
          <BookOpen size={18} aria-hidden />
          전체 북마크 URL 목록 보기
        </button>
        <p className="public-viewer-portal__footer-note">
          <Bookmark size={14} aria-hidden />
          이 루트 주소(`?mode=view`)는 안내용입니다. 업무 화면은 위 카드에서 선택하거나 북마크 URL로
          접속하세요.
        </p>
      </footer>
    </main>
  );
}
