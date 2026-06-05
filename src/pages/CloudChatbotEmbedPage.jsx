import React, { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { cloudChatbotEmbedUrl } from '../constants/cloudChatbotEnv';
import { useTeamAccess } from '../hooks/useTeamAccess';
import { uiTooltip } from '../utils/uiTooltip';
import './CloudChatbotEmbedPage.css';

const VIEWS = [
  { id: 'home', label: '게이트웨이', hint: '교육생·관리자 모드 선택' },
  { id: 'student', label: '교육생', hint: 'RAG 챗봇·요약·퀴즈' },
  { id: 'admin', label: '관리자', hint: '문서·프롬프트·로그 (팀장)', leaderOnly: true },
];

export default function CloudChatbotEmbedPage() {
  const teamAccess = useTeamAccess();
  const [view, setView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('chatbotView');
    return VIEWS.some((x) => x.id === v) ? v : 'home';
  });

  const visibleViews = useMemo(
    () => VIEWS.filter((v) => !v.leaderOnly || teamAccess.isLeader),
    [teamAccess.isLeader]
  );

  const embedSrc = cloudChatbotEmbedUrl(view);
  const openExternal = () => window.open(embedSrc, '_blank', 'noopener,noreferrer');

  const pickView = (id) => {
    setView(id);
    const url = new URL(window.location.href);
    if (id === 'home') url.searchParams.delete('chatbotView');
    else url.searchParams.set('chatbotView', id);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  };

  return (
    <main className="cloud-chatbot-embed-main">
      <header className="cloud-chatbot-embed-header">
        <div>
          <h1>클라우드 학습 챗봇</h1>
          <p className="cloud-chatbot-embed-lead">
            클라우드 학습용 RAG 챗봇·요약·퀴즈·지식 베이스. API는 Cloud Chatbot 서비스(Render)와 연동됩니다.
          </p>
        </div>
        <div className="cloud-chatbot-embed-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openExternal}
            {...uiTooltip('새 탭에서 전체 화면으로 열기')}
          >
            <ExternalLink size={16} /> 새 탭
          </button>
        </div>
      </header>

      <nav className="cloud-chatbot-embed-tabs" aria-label="챗봇 화면">
        {visibleViews.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`btn btn-secondary btn-sm${view === v.id ? ' is-active' : ''}`}
            onClick={() => pickView(v.id)}
            {...uiTooltip(v.hint)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <p className="cloud-chatbot-embed-hint">
        로컬 API 디버깅: <code>apps/cloud-chatbot</code> 에서 백엔드 실행 후{' '}
        <code>VITE_CLOUD_CHATBOT_ORIGIN=http://127.0.0.1:9999</code> 로 dev 서버 재시작.
      </p>

      <div className="cloud-chatbot-embed-frame-wrap">
        <iframe
          className="cloud-chatbot-embed-frame"
          title={`클라우드 학습 챗봇 — ${visibleViews.find((v) => v.id === view)?.label || view}`}
          src={embedSrc}
          allow="clipboard-read; clipboard-write; microphone"
        />
      </div>
    </main>
  );
}
