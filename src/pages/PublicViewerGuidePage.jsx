import React from 'react';
import { ArrowRight, Bookmark, ChevronRight, Lock, User, UserCheck } from 'lucide-react';
import AppModuleLink from '../components/AppModuleLink';
import {
  navigateToBookmarkReferenceDoc,
  PUBLIC_VIEWER_ADMIN_PORTAL,
  PUBLIC_VIEWER_USER_PORTALS,
} from '../constants/publicViewerPortal';
import { formatKpiMemberLabel } from '../constants/kpiMembers';
import { MEMBER_ROUTE_SLUG } from '../utils/appRoute';

const STEPS = ['이름 선택', '업무 화면 이동', '북마크 저장'];

function UserRow({ portal }) {
  const { member, links, primary, summary } = portal;
  const { label: primaryLabel, ...primaryNav } = primary;
  const Icon = member.isLeader ? UserCheck : User;

  return (
    <li className="pv-row">
      <span className="pv-row__avatar" aria-hidden>
        <Icon size={18} />
      </span>
      <div className="pv-row__main">
        <h3 className="pv-row__name">{formatKpiMemberLabel(member)}</h3>
        <p className="pv-row__desc">{summary}</p>
        <span className="pv-row__slug">/{MEMBER_ROUTE_SLUG[member.code]}</span>
      </div>
      <div className="pv-row__links">
        {links.map((link) => {
          const { label, ...linkNav } = link;
          return (
            <AppModuleLink key={`${portal.id}-${label}`} className="pv-chip" {...linkNav}>
              {label}
            </AppModuleLink>
          );
        })}
      </div>
      <AppModuleLink className="pv-cta" {...primaryNav}>
        {primaryLabel}
        <ArrowRight size={14} aria-hidden />
      </AppModuleLink>
    </li>
  );
}

function AdminRow({ portal }) {
  const { label, href } = portal.primary;
  return (
    <div className="pv-row pv-row--admin">
      <span className="pv-row__avatar" aria-hidden>
        <Lock size={18} />
      </span>
      <div className="pv-row__main">
        <h3 className="pv-row__name">{portal.title}</h3>
        <p className="pv-row__desc">장부 편집, KPI·승인 — 접속 시 비밀번호가 필요합니다.</p>
        <span className="pv-row__slug">/admin</span>
      </div>
      <a className="pv-cta pv-cta--outline" href={href}>
        {label}
        <ArrowRight size={14} aria-hidden />
      </a>
    </div>
  );
}

export default function PublicViewerGuidePage() {
  return (
    <main className="main-content pv-landing">
      <div className="pv-layout">
        <section className="pv-intro" aria-label="접속 안내">
          <div className="pv-intro__head">
            <p className="pv-eyebrow">EDU Team TMS</p>
            <h1 className="pv-title">
              업무 화면으로 <br />
              바로 연결.
            </h1>
            <p className="pv-lead">오른쪽 목록에서 본인을 선택하면 일지 작성 화면으로 이동합니다.</p>
            <ol className="pv-steps" aria-label="사용 순서">
              {STEPS.map((step, i) => (
                <li key={step} className="pv-steps__item">
                  <span className="pv-steps__no">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="pv-intro__foot">
            <button type="button" className="pv-link" onClick={navigateToBookmarkReferenceDoc}>
              <Bookmark size={14} aria-hidden />
              전체 북마크 URL 목록 (관리자)
              <ChevronRight size={14} aria-hidden />
            </button>
            <p className="pv-note">이 주소(`/`)는 안내용입니다. 업무는 개인 북마크 URL로 접속하세요.</p>
          </div>
        </section>

        <div className="pv-panel">
          <section aria-labelledby="pv-users-heading">
            <header className="pv-section-head">
              <p className="pv-eyebrow">Team Access</p>
              <h2 id="pv-users-heading" className="pv-section-title">
                사용자 접속
              </h2>
            </header>
            <ul className="pv-list">
              {PUBLIC_VIEWER_USER_PORTALS.map((portal) => (
                <UserRow key={portal.id} portal={portal} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="pv-admin-heading">
            <header className="pv-section-head">
              <p className="pv-eyebrow pv-eyebrow--point">Team Admin</p>
              <h2 id="pv-admin-heading" className="pv-section-title">
                팀 관리
              </h2>
            </header>
            <div className="pv-list">
              <AdminRow portal={PUBLIC_VIEWER_ADMIN_PORTAL} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
