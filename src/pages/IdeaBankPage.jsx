import React, { useState } from 'react';
import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import { useIdeaBankItems } from '../hooks/useIdeaBankItems';
import './IdeaBankPage.css';

function formatDate(value) {
  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return value;
  }
}

export default function IdeaBankPage({ readOnly = false }) {
  const { items, count, addItem, removeItem } = useIdeaBankItems();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = addItem({ name, description });
    if (!result.ok) {
      if (result.reason === 'name-required') setMessage('서비스명을 입력해 주세요.');
      if (result.reason === 'duplicate-name') setMessage('이미 등록된 서비스명입니다.');
      return;
    }
    setName('');
    setDescription('');
    setMessage('요청이 등록되었습니다.');
  };

  return (
    <main className="idea-bank-page">
      <header className="idea-bank-header">
        <h2>
          <Lightbulb size={18} aria-hidden />
          이것도 아이디어뱅크
        </h2>
        <p>팀원들이 원하는 서비스명을 모아 다음 개발 아이템으로 정리합니다.</p>
        <strong>누적 요청 {count}건</strong>
      </header>

      <section className="idea-bank-panel">
        {readOnly && (
          <p className="idea-bank-readonly">조회 모드에서도 아이디어 등록은 가능합니다. 삭제는 작성 모드에서만 가능합니다.</p>
        )}
        <form className="idea-bank-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="idea-name">서비스명</label>
            <input
              id="idea-name"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 회의록 자동 요약"
              maxLength={80}
            />
          </div>
          <div className="form-group">
            <label htmlFor="idea-desc">한 줄 설명 (선택)</label>
            <input
              id="idea-desc"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 팀 노션 페이지를 자동으로 정리해주는 도구"
              maxLength={140}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Plus size={14} />
            요청 추가
          </button>
        </form>
        {message && <p className="idea-bank-message">{message}</p>}
      </section>

      <section className="idea-bank-list">
        {items.length === 0 ? (
          <div className="idea-bank-empty">아직 등록된 요청이 없습니다.</div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="idea-bank-item">
              <div>
                <h3>{item.name}</h3>
                {item.description && <p>{item.description}</p>}
                <small>{formatDate(item.createdAt)}</small>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn-secondary idea-bank-remove"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
