import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ChevronRight, Menu } from 'lucide-react';
import MarkdownDocViewer from '../components/MarkdownDocViewer';
import DocTableOfContents from '../components/DocTableOfContents';
import {
  DEFAULT_REFERENCE_DOC_ID,
  REF_DOC_CATEGORIES,
  LECTURE_GROUP_COLORS,
  LECTURE_GUIDE_GROUPS,
  LECTURE_HOME_ID,
  REFERENCE_DOCS_NAV,
  findReferenceDoc,
  referenceDocPublicUrl,
} from '../constants/referenceDocs';
import {
  hideReferenceDoc,
  listHiddenReferenceDocIds,
  restoreReferenceDoc,
} from '../utils/referenceDocsHidden';
import heroBg from '../assets/okestro/Cover_bg.jpg';
import wordmark from '../assets/okestro/logo-wordmark.svg';
import './ReferenceDocsPage.css';

function readDocIdFromUrl() {
  const id = new URLSearchParams(window.location.search).get('doc') || DEFAULT_REFERENCE_DOC_ID;
  return findReferenceDoc(id) ? id : DEFAULT_REFERENCE_DOC_ID;
}

export default function ReferenceDocsPage({ isAdminShell = false }) {
  const [docId, setDocId] = useState(readDocIdFromUrl);
  const [headings, setHeadings] = useState([]);
  const [navOpen, setNavOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const articleScrollRef = useRef(null);
  const [articleScrollEl, setArticleScrollEl] = useState(null);

  useEffect(() => {
    const onPop = () => setDocId(readDocIdFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const selectDoc = useCallback((id) => {
    const url = new URL(window.location.href);
    url.searchParams.set('doc', id);
    window.history.pushState({}, '', url);
    setDocId(id);
    setNavOpen(false);
    articleScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const onHeadingsChange = useCallback((next) => {
    setHeadings(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listHiddenReferenceDocIds().then((ids) => {
      if (!cancelled) setHiddenIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isHidden = useCallback((id) => hiddenIds.includes(id), [hiddenIds]);

  const toggleHidden = useCallback(
    async (id, hide) => {
      setBusy(true);
      setActionError('');
      const res = hide ? await hideReferenceDoc(id) : await restoreReferenceDoc(id);
      setBusy(false);
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setHiddenIds((prev) => (hide ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
    },
    [],
  );

  const active = findReferenceDoc(docId) || findReferenceDoc(DEFAULT_REFERENCE_DOC_ID);
  const activeHiddenForViewer = Boolean(active && !isAdminShell && isHidden(active.id));
  const src = active && !activeHiddenForViewer && active.file ? referenceDocPublicUrl(active.file) : '';
  const isHtml = active?.format === 'html' && !activeHiddenForViewer;
  const isIndex = active?.format === 'index';
  const wide = isHtml || isIndex;

  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get('doc');
    if (urlId && !findReferenceDoc(urlId)) {
      selectDoc(DEFAULT_REFERENCE_DOC_ID);
    }
  }, [selectDoc]);

  return (
    <main className="ref-docs-shell">
      <div className="ref-docs-toolbar">
        <button
          type="button"
          className="ref-docs-toolbar__menu btn btn-secondary"
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          aria-controls="ref-docs-nav"
        >
          <Menu size={18} aria-hidden />
          문서
        </button>
        <nav className="ref-docs-breadcrumb" aria-label="경로">
          <span className="ref-docs-breadcrumb__root">참고문서</span>
          <ChevronRight size={14} className="ref-docs-breadcrumb__sep" aria-hidden />
          <span className="ref-docs-breadcrumb__current">{active?.title}</span>
        </nav>
      </div>

      <div className={`ref-docs-body${navOpen ? ' is-nav-open' : ''}${wide ? ' is-html' : ''}`}>
        <aside id="ref-docs-nav" className="ref-docs-nav" aria-label="문서 목록">
          <div className="ref-docs-nav__inner">
            <p className="ref-docs-nav__title">문서</p>
            <ul className="ref-docs-nav__list">
              {REFERENCE_DOCS_NAV.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={`ref-docs-nav__link${active?.id === d.id ? ' is-active' : ''}`}
                    onClick={() => selectDoc(d.id)}
                  >
                    {d.title}
                  </button>
                </li>
              ))}
            </ul>
            <p className="ref-docs-nav__title ref-docs-nav__title--section">강의 가이드</p>
            <ul className="ref-docs-nav__list">
              <li>
                <button
                  type="button"
                  className={`ref-docs-nav__link${isIndex ? ' is-active' : ''}`}
                  onClick={() => selectDoc(LECTURE_HOME_ID)}
                >
                  전체 가이드 모음
                </button>
              </li>
            </ul>
            {LECTURE_GUIDE_GROUPS.map((g) => ({
              ...g,
              docs: g.docs.filter((d) => isAdminShell || !isHidden(d.id)),
            }))
              .filter((g) => g.docs.length > 0)
              .map((g) => (
              <div key={g.name} className="ref-docs-nav__group">
                <p className="ref-docs-nav__group-name">{g.name}</p>
                <ul className="ref-docs-nav__list">
                  {g.docs.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        className={`ref-docs-nav__link${active?.id === d.id ? ' is-active' : ''}`}
                        onClick={() => selectDoc(d.id)}
                      >
                        {d.title}
                        {isHidden(d.id) && <span className="ref-docs-nav__badge">숨김</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {navOpen && (
          <button
            type="button"
            className="ref-docs-nav-backdrop"
            aria-label="문서 목록 닫기"
            onClick={() => setNavOpen(false)}
          />
        )}

        <div
          ref={(el) => {
            articleScrollRef.current = el;
            setArticleScrollEl(el);
          }}
          className="ref-docs-article-scroll"
        >
          <div className={`ref-docs-article-panel${wide ? ' ref-docs-article-panel--wide' : ''}${isIndex ? ' ref-docs-article-panel--home' : ''}`}>
            {activeHiddenForViewer ? (
              <p className="ref-docs-hidden-notice">이 가이드는 목록에서 숨겨졌습니다.</p>
            ) : null}
            {active && !activeHiddenForViewer && !isIndex && (
              <header className="ref-docs-article-header">
                <p className="ref-docs-article-eyebrow">{REF_DOC_CATEGORIES[active.category]}</p>
                <h1 className="ref-docs-article-title">{active.title}</h1>
                {active.summary && <p className="ref-docs-article-summary">{active.summary}</p>}
                {isAdminShell && active.format === 'html' && (
                  <div className="ref-docs-admin-bar">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => toggleHidden(active.id, !isHidden(active.id))}
                    >
                      {isHidden(active.id) ? '숨김 해제(복구)' : '목록에서 숨기기'}
                    </button>
                    {isHidden(active.id) && (
                      <span className="ref-docs-admin-bar__note">구성원에게는 보이지 않습니다.</span>
                    )}
                    {actionError && <span className="ref-docs-admin-bar__error">{actionError}</span>}
                  </div>
                )}
              </header>
            )}
            {isIndex ? (
              <>
                <section className="ref-docs-hero" style={{ backgroundImage: `url(${heroBg})` }}>
                  <img className="ref-docs-hero__logo" src={wordmark} alt="OKESTRO" />
                  <h1 className="ref-docs-hero__title">{active.title}</h1>
                  <p className="ref-docs-hero__desc">{active.summary}</p>
                  <button
                    type="button"
                    className="ref-docs-hero__cta"
                    onClick={() =>
                      document.getElementById('lecture-guide-list')?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    가이드 둘러보기
                    <ArrowDown size={16} aria-hidden />
                  </button>
                </section>
                <div className="ref-docs-index" id="lecture-guide-list">
                {LECTURE_GUIDE_GROUPS.map((g) => ({
                  ...g,
                  docs: g.docs.filter((d) => isAdminShell || !isHidden(d.id)),
                }))
                  .filter((g) => g.docs.length > 0)
                  .map((g) => (
                    <section key={g.name} className="ref-docs-index__group">
                      <div className="ref-docs-index__group-head">
                        <span
                          className="ref-docs-index__badge"
                          style={{ '--okd-product': LECTURE_GROUP_COLORS[g.name] }}
                        >
                          {g.name}
                        </span>
                        <h2 className="ref-docs-index__group-name">시연·구성 가이드</h2>
                        <span className="ref-docs-index__count">{g.docs.length}개</span>
                      </div>
                      <div className="ref-docs-index__grid">
                        {g.docs.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className={`ref-docs-card${isHidden(d.id) ? ' is-hidden' : ''}`}
                            onClick={() => selectDoc(d.id)}
                          >
                            <span className="ref-docs-card__title">{d.title}</span>
                            {d.summary && <span className="ref-docs-card__summary">{d.summary}</span>}
                            <span
                              className={`ref-docs-card__meta${isHidden(d.id) ? ' ref-docs-card__meta--hidden' : ''}`}
                            >
                              {isHidden(d.id) ? '숨김 · 관리자에게만 보임' : '가이드 열기'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : activeHiddenForViewer ? null : isHtml ? (
              <>
                <p className="ref-docs-html-actions">
                  <a href={src} target="_blank" rel="noopener noreferrer">
                    새 탭에서 열기
                  </a>
                </p>
                <iframe
                  key={src}
                  className="ref-docs-html-frame"
                  src={src}
                  title={active.title}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              </>
            ) : (
              <MarkdownDocViewer key={src} src={src} onHeadingsChange={onHeadingsChange} onDocSelect={selectDoc} />
            )}
          </div>
        </div>

        {!wide && (
          <aside className="ref-docs-toc-rail" aria-label="이 페이지 목차">
            <div className="ref-docs-toc-rail__inner">
              <p className="ref-docs-toc-rail__title">On this page</p>
              <DocTableOfContents headings={headings} scrollRoot={articleScrollEl} />
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
