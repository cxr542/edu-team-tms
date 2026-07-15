import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  Folder,
  FileText,
  RefreshCcw,
  Home,
} from 'lucide-react';
import { fetchLectureJournalChildren } from '../utils/confluenceLectureApi.js';
import './LectureJournalPage.css';

const ROOT_CRUMB = { id: '', title: '강의일지', type: 'folder' };

/**
 * @typedef {{ id: string, title: string, type: string }} Crumb
 */

export default function LectureJournalPage() {
  const [crumbs, setCrumbs] = useState(/** @type {Crumb[]} */ ([ROOT_CRUMB]));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailableMessage, setUnavailableMessage] = useState('');
  const [rootFolderId, setRootFolderId] = useState('');

  const current = crumbs[crumbs.length - 1];

  const load = useCallback(async (crumbList) => {
    const leaf = crumbList[crumbList.length - 1];
    setLoading(true);
    setError('');
    setUnavailableMessage('');
    try {
      const opts =
        leaf.id && leaf.id !== ''
          ? { parentId: leaf.id, parentType: leaf.type === 'page' ? 'page' : 'folder' }
          : {};
      const data = await fetchLectureJournalChildren(opts);
      if (data.rootFolderId) setRootFolderId(data.rootFolderId);
      if (!data.available) {
        setItems([]);
        setUnavailableMessage(
          data.message || data.error || 'Confluence 연동이 설정되지 않았습니다.'
        );
        return;
      }
      setItems(data.items);
    } catch (e) {
      setItems([]);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(crumbs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when navigating crumbs
  }, [crumbs]);

  function openFolder(item) {
    if (item.type !== 'folder') return;
    setCrumbs((prev) => [...prev, { id: item.id, title: item.title, type: 'folder' }]);
  }

  function goToCrumb(index) {
    setCrumbs((prev) => prev.slice(0, index + 1));
  }

  function goRoot() {
    setCrumbs([ROOT_CRUMB]);
  }

  return (
    <main className="lecture-journal-page">
      <header className="lecture-journal-header">
        <div className="lecture-journal-header__brand">
          <span className="lecture-journal-header__icon" aria-hidden>
            <BookOpen size={22} />
          </span>
          <div>
            <h1>강의일지</h1>
            <p className="lecture-journal-header__tagline">
              Confluence 「02. 강의일지 폴더」 목록 · 본문은 Confluence에서 엽니다
            </p>
          </div>
        </div>
        <button
          type="button"
          className="lecture-journal-refresh"
          onClick={() => load(crumbs)}
          disabled={loading}
        >
          <RefreshCcw size={16} aria-hidden />
          새로고침
        </button>
      </header>

      <nav className="lecture-journal-crumbs" aria-label="경로">
        <button type="button" className="lecture-journal-crumb" onClick={goRoot}>
          <Home size={14} aria-hidden />
          루트
        </button>
        {crumbs.map((c, i) => (
          <React.Fragment key={`${c.id || 'root'}-${i}`}>
            <ChevronRight size={14} className="lecture-journal-crumb-sep" aria-hidden />
            <button
              type="button"
              className={`lecture-journal-crumb${i === crumbs.length - 1 ? ' is-current' : ''}`}
              onClick={() => goToCrumb(i)}
              disabled={i === crumbs.length - 1}
            >
              {c.title}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {unavailableMessage && (
        <div className="lecture-journal-banner lecture-journal-banner--warn" role="status">
          <p>{unavailableMessage}</p>
          <p className="lecture-journal-banner__hint">
            서버에 <code>CONFLUENCE_EMAIL</code> / <code>CONFLUENCE_API_TOKEN</code> 을 설정한 뒤
            다시 시도하세요. (로컬은 <code>.env.local</code>, 운영은 Vercel env)
          </p>
        </div>
      )}

      {error && (
        <div className="lecture-journal-banner lecture-journal-banner--error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="lecture-journal-empty">불러오는 중…</div>
      ) : !unavailableMessage && items.length === 0 ? (
        <div className="lecture-journal-empty">이 폴더에 항목이 없습니다.</div>
      ) : (
        <ul className="lecture-journal-list">
          {items.map((item) => {
            const isFolder = item.type === 'folder';
            return (
              <li key={`${item.type}-${item.id}`} className="lecture-journal-item">
                <div className="lecture-journal-item__main">
                  <span className="lecture-journal-item__icon" aria-hidden>
                    {isFolder ? <Folder size={18} /> : <FileText size={18} />}
                  </span>
                  {isFolder ? (
                    <button
                      type="button"
                      className="lecture-journal-item__title-btn"
                      onClick={() => openFolder(item)}
                    >
                      {item.title}
                    </button>
                  ) : (
                    <span className="lecture-journal-item__title">{item.title}</span>
                  )}
                  <span className="lecture-journal-item__type">{isFolder ? '폴더' : '페이지'}</span>
                </div>
                <div className="lecture-journal-item__actions">
                  {isFolder && (
                    <button type="button" className="lecture-journal-link-btn" onClick={() => openFolder(item)}>
                      열기
                      <ChevronRight size={14} aria-hidden />
                    </button>
                  )}
                  {item.webUi && (
                    <a
                      className="lecture-journal-link-btn lecture-journal-link-btn--ext"
                      href={item.webUi}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Confluence
                      <ExternalLink size={14} aria-hidden />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {rootFolderId && (
        <p className="lecture-journal-footnote">
          루트 폴더 id <code>{rootFolderId}</code>
          {current?.id ? (
            <>
              {' '}
              · 현재 <code>{current.id}</code>
            </>
          ) : null}
        </p>
      )}
    </main>
  );
}
