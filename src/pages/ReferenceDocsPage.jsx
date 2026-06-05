import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Menu } from 'lucide-react';
import MarkdownDocViewer from '../components/MarkdownDocViewer';
import DocTableOfContents from '../components/DocTableOfContents';
import {
  DEFAULT_REFERENCE_DOC_ID,
  REF_DOC_CATEGORIES,
  REFERENCE_DOCS_NAV,
  findReferenceDoc,
  isReferenceDocInNav,
  referenceDocPublicUrl,
} from '../constants/referenceDocs';
import './ReferenceDocsPage.css';

function readDocIdFromUrl() {
  const id = new URLSearchParams(window.location.search).get('doc') || DEFAULT_REFERENCE_DOC_ID;
  return isReferenceDocInNav(id) ? id : DEFAULT_REFERENCE_DOC_ID;
}

export default function ReferenceDocsPage() {
  const [docId, setDocId] = useState(readDocIdFromUrl);
  const [headings, setHeadings] = useState([]);
  const [navOpen, setNavOpen] = useState(false);
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

  const active = findReferenceDoc(docId) || findReferenceDoc(DEFAULT_REFERENCE_DOC_ID);
  const src = active ? referenceDocPublicUrl(active.file) : '';

  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get('doc');
    if (urlId && !isReferenceDocInNav(urlId)) {
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

      <div className={`ref-docs-body${navOpen ? ' is-nav-open' : ''}`}>
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
          <div className="ref-docs-article-panel">
            {active && (
              <header className="ref-docs-article-header">
                <p className="ref-docs-article-eyebrow">{REF_DOC_CATEGORIES[active.category]}</p>
                <h1 className="ref-docs-article-title">{active.title}</h1>
                {active.summary && <p className="ref-docs-article-summary">{active.summary}</p>}
              </header>
            )}
            <MarkdownDocViewer key={src} src={src} onHeadingsChange={onHeadingsChange} />
          </div>
        </div>

        <aside className="ref-docs-toc-rail" aria-label="이 페이지 목차">
          <div className="ref-docs-toc-rail__inner">
            <p className="ref-docs-toc-rail__title">On this page</p>
            <DocTableOfContents headings={headings} scrollRoot={articleScrollEl} />
          </div>
        </aside>
      </div>
    </main>
  );
}
