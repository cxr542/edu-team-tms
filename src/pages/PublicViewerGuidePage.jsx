import React from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';
import AppModuleLink from '../components/AppModuleLink';
import { URL_ACCESS_LEADER } from '../constants/teamAccess';

const LEDGER_YEAR = 2026;
const LEDGER_MONTH = 6;

const OFFICIAL_LINKS = [
  {
    label: '팀장 화면',
    module: 'ledger',
    mode: 'edit',
    access: URL_ACCESS_LEADER,
  },
  {
    label: '구성원 B · 일일 업무일지',
    module: 'journal',
    mode: 'edit',
    member: 'B',
  },
  {
    label: '구성원 B · 장부 조회',
    module: 'ledger',
    mode: 'view',
    member: 'B',
    year: LEDGER_YEAR,
    month: LEDGER_MONTH,
  },
  {
    label: '구성원 C · 일일 업무일지',
    module: 'journal',
    mode: 'edit',
    member: 'C',
  },
  {
    label: '구성원 C · 장부 조회',
    module: 'ledger',
    mode: 'view',
    member: 'C',
    year: LEDGER_YEAR,
    month: LEDGER_MONTH,
  },
];

export default function PublicViewerGuidePage() {
  return (
    <main className="main-content public-viewer-guide">
      <div
        className="custom-alert"
        style={{
          marginBottom: '1.5rem',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          borderLeft: '4px solid #3b82f6',
        }}
      >
        <AlertCircle size={20} style={{ color: '#60a5fa', flexShrink: 0 }} />
        <div className="custom-alert-content">
          <h4 style={{ color: '#93c5fd', marginBottom: '0.5rem' }}>공개 조회 화면 사용 중단</h4>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
            공개 조회 화면은 더 이상 사용하지 않습니다.
            <br />
            팀장 또는 구성원 전용 URL로 접속해 주세요.
            <br />
            구성원은 본인 일일 업무일지 URL과 장부 조회 URL을 사용합니다.
          </p>
        </div>
      </div>

      <section className="public-viewer-guide__links" aria-labelledby="public-viewer-guide-title">
        <h2 id="public-viewer-guide-title" className="public-viewer-guide__title">
          공식 접속 URL
        </h2>
        <ul className="public-viewer-guide__list">
          {OFFICIAL_LINKS.map((link) => (
            <li key={link.label}>
              <AppModuleLink
                className="public-viewer-guide__link btn btn-secondary"
                module={link.module}
                mode={link.mode}
                member={link.member}
                access={link.access}
                year={link.year}
                month={link.month}
              >
                <ExternalLink size={16} aria-hidden />
                {link.label}
              </AppModuleLink>
            </li>
          ))}
        </ul>
        <p className="public-viewer-guide__hint">
          위 링크는 역할별 권한 정책을 그대로 따릅니다. 북마크·공유는 주소창 URL을 사용하세요.
        </p>
      </section>
    </main>
  );
}
