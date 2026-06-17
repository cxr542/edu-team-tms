import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  ChevronRight,
  Lock,
  NotebookPen,
  Shield,
  User,
  UserCheck,
} from 'lucide-react';
import AppModuleLink from '../components/AppModuleLink';
import {
  navigateToBookmarkReferenceDoc,
  PUBLIC_VIEWER_ADMIN_PORTAL,
  PUBLIC_VIEWER_USER_PORTALS,
} from '../constants/publicViewerPortal';
import { formatKpiMemberLabel } from '../constants/kpiMembers';
import { MEMBER_ROUTE_SLUG } from '../utils/appRoute';

const MEMBER_ICONS = {
  A: UserCheck,
  B: User,
  C: User,
};

const CARD_DECOR = {
  admin: { emoji: '🔐', label: 'Admin' },
  A: { emoji: '✍️', label: 'Write' },
  B: { emoji: '📊', label: 'Check' },
  C: { emoji: '🗂️', label: 'Ops' },
};

function RolePortalCard({ portal, variant = 'default' }) {
  const { primary, links, member, badge, summary, title, kind } = portal;
  const { label: primaryLabel, href, ...primaryNav } = primary;
  const isAdmin = kind === 'admin';
  const isCompact = variant === 'compact';
  const MemberIcon = member ? MEMBER_ICONS[member.code] || User : Shield;
  const decor = isAdmin ? CARD_DECOR.admin : CARD_DECOR[member?.code] || CARD_DECOR.C;
  const toneClass = isAdmin
    ? 'portal-card--tone-admin'
    : member
      ? `portal-card--tone-${member.code.toLowerCase()}`
      : '';

  return (
    <article
      className={`portal-card ${toneClass}${isCompact ? ' portal-card--compact' : ''}${
        isAdmin ? ' portal-card--gated' : ''
      }`}
    >
      <div className="portal-card__top">
        <div className="portal-card__icon" aria-hidden>
          {isAdmin ? <Lock size={22} /> : <MemberIcon size={22} />}
        </div>
        <div className="portal-card__meta">
          <span className="portal-card__label">
            {isAdmin ? 'TEAM ADMIN' : `USER · ${badge}`}
          </span>
          <h2 className="portal-card__title">
            {isAdmin ? title : formatKpiMemberLabel(member)}
          </h2>
          <p className="portal-card__summary">{summary}</p>
        </div>
      </div>

      {links.length > 0 && (
        <div className="portal-card__quick">
          {links.map((link) => {
            const { label, ...linkNav } = link;
            return (
              <AppModuleLink key={`${portal.id}-${label}`} className="portal-chip" {...linkNav}>
                {label}
              </AppModuleLink>
            );
          })}
        </div>
      )}

      <div className="portal-card__bottom">
        <div className="portal-card__actions">
          {href ? (
            <a className="portal-card__cta portal-card__open" href={href}>
              {primaryLabel}
              <ArrowRight size={16} aria-hidden />
            </a>
          ) : (
            <AppModuleLink
              className="portal-card__cta portal-card__open portal-card__cta--primary"
              {...primaryNav}
            >
              {primaryLabel}
              <ArrowRight size={16} aria-hidden />
            </AppModuleLink>
          )}
          {!isAdmin && member && (
            <span className="portal-card__slug">/{MEMBER_ROUTE_SLUG[member.code]}</span>
          )}
          {isAdmin && <span className="portal-card__slug">/admin</span>}
        </div>
      </div>
      <span className="portal-card__corner-emoji" aria-hidden>
        <span className="portal-card__corner-symbol">{decor.emoji}</span>
        <span className="portal-card__corner-label">{decor.label}</span>
      </span>
    </article>
  );
}

export default function PublicViewerGuidePage() {
  return (
    <main className="main-content public-viewer-portal">
      <section className="public-viewer-portal__hero-grid">
        <div className="public-viewer-portal__hero-copy">
          <div className="public-viewer-portal__intro-row">
            <p className="public-viewer-portal__eyebrow">EDU Team TMS</p>
            <span className="public-viewer-portal__hero-badge">Role-based access</span>
          </div>
          <h1 className="public-viewer-portal__title">
            업무 화면으로
            <br />
            바로 연결.
          </h1>
          <p className="public-viewer-portal__lead">
            본인 카드에서 일지 작성 화면으로 바로 이동하세요.
          </p>
          <div className="public-viewer-portal__workflow" aria-label="사용 순서">
            <span>이름 선택</span>
            <ChevronRight size={14} aria-hidden />
            <span>업무 화면 이동</span>
            <ChevronRight size={14} aria-hidden />
            <span>북마크 저장</span>
          </div>
        </div>

        <aside className="public-viewer-portal__status" aria-label="접속 안내 요약">
          <div className="public-viewer-portal__status-head">
            <strong>접속 안내</strong>
            <span className="public-viewer-portal__status-pill">
              <span className="public-viewer-portal__status-dot" aria-hidden />
              Ready
            </span>
          </div>
          <dl className="public-viewer-portal__stat-list">
            <div className="public-viewer-portal__stat">
              <dt>사용자</dt>
              <dd>3명 · A / B / C</dd>
            </div>
            <div className="public-viewer-portal__stat">
              <dt>기본 화면</dt>
              <dd>일지 작성</dd>
            </div>
            <div className="public-viewer-portal__stat">
              <dt>팀 관리</dt>
              <dd>/admin · 비밀번호</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="public-viewer-portal__section public-viewer-portal__section--users" aria-labelledby="portal-users-heading">
        <header className="public-viewer-portal__section-head">
          <div>
            <p className="public-viewer-portal__section-kicker">Team Access</p>
            <h2 id="portal-users-heading" className="public-viewer-portal__section-title">
              사용자 접속
            </h2>
            <p className="public-viewer-portal__section-desc">
              이름을 선택해 일지·역량·장부 조회 화면으로 이동합니다.
            </p>
          </div>
          <span className="public-viewer-portal__section-pill">
            <NotebookPen size={14} aria-hidden />
            Live
          </span>
        </header>

        <div className="public-viewer-portal__section-surface">
          <div className="public-viewer-portal__grid public-viewer-portal__grid--users">
            {PUBLIC_VIEWER_USER_PORTALS.map((portal) => (
              <RolePortalCard key={portal.id} portal={portal} />
            ))}
          </div>
        </div>
      </section>

      <section className="public-viewer-portal__section public-viewer-portal__section--admin" aria-labelledby="portal-admin-heading">
        <header className="public-viewer-portal__section-head">
          <div>
            <p className="public-viewer-portal__section-kicker">Team Admin</p>
            <h2 id="portal-admin-heading" className="public-viewer-portal__section-title">
              팀 관리
            </h2>
            <p className="public-viewer-portal__section-desc">
              장부 편집, KPI·승인 — 접속 시 비밀번호가 필요합니다.
            </p>
          </div>
        </header>

        <div className="public-viewer-portal__section-surface public-viewer-portal__section-surface--admin">
          <div className="public-viewer-portal__grid public-viewer-portal__grid--admin">
            <RolePortalCard portal={PUBLIC_VIEWER_ADMIN_PORTAL} variant="compact" />
          </div>
        </div>
      </section>

      <footer className="public-viewer-portal__footer">
        <button
          type="button"
          className="public-viewer-portal__footer-link"
          onClick={navigateToBookmarkReferenceDoc}
        >
          <BookOpen size={16} aria-hidden />
          전체 북마크 URL 목록 (관리자)
          <ChevronRight size={14} aria-hidden />
        </button>
        <p className="public-viewer-portal__footer-note">
          <Bookmark size={14} aria-hidden />
          이 주소(`/`)는 안내용입니다. 업무는 위 카드·개인 북마크 URL로 접속하세요.
        </p>
      </footer>
    </main>
  );
}
