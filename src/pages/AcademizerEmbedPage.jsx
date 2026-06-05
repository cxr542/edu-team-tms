import React from 'react';
import { academizerEmbedPath } from '../constants/academizerEnv';
import './AcademizerEmbedPage.css';

export default function AcademizerEmbedPage() {
  const embedSrc = academizerEmbedPath();

  return (
    <main className="academizer-embed-main">
      <header className="academizer-embed-header">
        <h1>PPT 아카데미화</h1>
        <p className="academizer-embed-lead">
          일반·AI pptx를 OKESTRO 아카데미 강의안 형식으로 변환합니다.
        </p>
      </header>

      <p className="academizer-embed-hint">
        운영 변환은 Netlify API를 사용합니다. 로컬 API 디버깅이 필요할 때만 sibling{' '}
        <code>ppt-academizer</code> repo에서 <code>./scripts/run_server.sh</code> 실행 후{' '}
        <code>npm run sync:academizer:dev</code> 로 프록시를 맞추세요.
      </p>

      <div className="academizer-embed-frame-wrap">
        <iframe
          className="academizer-embed-frame"
          title="PPT 아카데미화"
          src={embedSrc}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </main>
  );
}
