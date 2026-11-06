import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ChevronRight, Menu } from 'lucide-react';
import MarkdownDocViewer from '../components/MarkdownDocViewer';
import DocTableOfContents from '../components/DocTableOfContents';
import LectureGuideFrame from '../components/LectureGuideFrame';
import LectureGuideUploadPanel from '../components/LectureGuideUploadPanel';
import {
  DEFAULT_REFERENCE_DOC_ID,
  REF_DOC_CATEGORIES,
  LECTURE_PRODUCT_COLORS,
  LECTURE_GUIDE_GROUPS,
  LECTURE_HOME_ID,
  REFERENCE_DOCS_NAV,
  findReferenceDoc,
  referenceDocPublicUrl,
} from '../constants/referenceDocs';
import {
  fetchUploadedGuideHtml,
  hideReferenceDoc,
  listHiddenReferenceDocIds,
  listUploadedGuides,
  purgeUploadedGuide,
  restoreReferenceDoc,
} from '../utils/referenceDocsHidden';
import { buildProductTree, productColor } from '../utils/lectureGuideTree';
import { downloadHtmlFile, guideFileName } from '../utils/downloadHtml';
import heroBg from '../assets/okestro/Cover_bg.jpg';
import wordmark from '../assets/okestro/logo-wordmark.svg';
import './ReferenceDocsPage.css';

const UPLOAD_ID_PREFIX = 'lecture-u-';
const DEFAULT_GROUP_COLOR = '#1038ed';

function readDocIdFromUrl() {
  const id = new URLSearchParams(window.location.search).get('doc') || DEFAULT_REFERENCE_DOC_ID;
  // 업로드본은 목록을 불러온 뒤에야 존재 여부를 알 수 있으므로 접두사만 보고 통과시킨다.
  return findReferenceDoc(id) || id.startsWith(UPLOAD_ID_PREFIX) ? id : DEFAULT_REFERENCE_DOC_ID;
}

export default function ReferenceDocsPage({ isAdminShell = false }) {
  const [docId, setDocId] = useState(readDocIdFromUrl);
  const [headings, setHeadings] = useState([]);
  const [guideHeadings, setGuideHeadings] = useState([]);
  const [guideActiveId, setGuideActiveId] = useState('');
  const guideJumpRef = useRef(null);
  const [navOpen, setNavOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [uploadsLoaded, setUploadsLoaded] = useState(false);
  const [uploadedHtml, setUploadedHtml] = useState({ id: '', html: '', error: '' });
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

  const reloadUploads = useCallback(async () => {
    const list = await listUploadedGuides();
    setUploadedDocs(list);
    setUploadsLoaded(true);
  }, []);

  useEffect(() => {
    reloadUploads();
  }, [reloadUploads]);

  const findDoc = useCallback(
    (id) => findReferenceDoc(id) || uploadedDocs.find((d) => d.id === id) || null,
    [uploadedDocs]
  );

  /** 저장소 가이드 + 업로드본을 그룹별로 묶는다 (저장소 그룹이 먼저). */
  const guideGroups = useMemo(() => {
    const groups = LECTURE_GUIDE_GROUPS.map((g) => ({ name: g.name, docs: [...g.docs] }));
    for (const d of uploadedDocs) {
      let g = groups.find((x) => x.name === d.group);
      if (!g) {
        g = { name: d.group, docs: [] };
        groups.push(g);
      }
      g.docs.push(d);
    }
    return groups;
  }, [uploadedDocs]);

  const isHidden = useCallback((id) => hiddenIds.includes(id), [hiddenIds]);

  /** 제품(대분류) → 버전(중분류) 트리. 일반 사용자에게는 숨김 문서를 뺀다. */
  const visibleTree = useMemo(
    () =>
      buildProductTree(
        guideGroups
          .map((g) => ({ ...g, docs: g.docs.filter((d) => isAdminShell || !hiddenIds.includes(d.id)) }))
          .filter((g) => g.docs.length > 0)
      ),
    [guideGroups, hiddenIds, isAdminShell]
  );

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

  const active = findDoc(docId) || (uploadsLoaded ? findReferenceDoc(DEFAULT_REFERENCE_DOC_ID) : null);
  const activeHiddenForViewer = Boolean(active && !isAdminShell && isHidden(active.id));
  const src = active && !activeHiddenForViewer && active.file ? referenceDocPublicUrl(active.file) : '';
  const isUploadedActive = Boolean(active?.uploaded);
  const isHtml = active?.format === 'html' && !activeHiddenForViewer;
  const isIndex = active?.format === 'index';
  const wide = isHtml || isIndex;

  useEffect(() => {
    setGuideHeadings([]);
    setGuideActiveId('');
  }, [docId]);

  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get('doc');
    if (uploadsLoaded && urlId && !findDoc(urlId)) {
      selectDoc(DEFAULT_REFERENCE_DOC_ID);
    }
  }, [selectDoc, uploadsLoaded, findDoc]);

  // 업로드본은 본문을 따로 불러와 srcDoc 으로 보여 준다.
  useEffect(() => {
    if (!isUploadedActive || activeHiddenForViewer) return undefined;
    let cancelled = false;
    setUploadedHtml({ id: '', html: '', error: '' });
    fetchUploadedGuideHtml(active.id).then((res) => {
      if (cancelled) return;
      setUploadedHtml(
        res.ok ? { id: active.id, html: res.html, error: '' } : { id: active.id, html: '', error: res.message }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isUploadedActive, activeHiddenForViewer, active?.id]);

  const downloadActive = useCallback(async () => {
    if (!active) return;
    setBusy(true);
    setActionError('');
    let html = '';
    if (active.uploaded) {
      if (uploadedHtml.id === active.id && uploadedHtml.html) {
        html = uploadedHtml.html;
      } else {
        const res = await fetchUploadedGuideHtml(active.id);
        if (res.ok) html = res.html;
        else setActionError(res.message);
      }
    } else {
      try {
        const res = await fetch(referenceDocPublicUrl(active.file));
        if (!res.ok) throw new Error(String(res.status));
        html = await res.text();
      } catch {
        setActionError('파일을 불러오지 못했습니다.');
      }
    }
    setBusy(false);
    if (html) downloadHtmlFile(guideFileName(active.title), html);
  }, [active, uploadedHtml]);

  const purgeActive = useCallback(async () => {
    if (!active?.uploaded) return;
    if (!window.confirm(`'${active.title}' 가이드를 완전히 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    setActionError('');
    const res = await purgeUploadedGuide(active.id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await reloadUploads();
    selectDoc(LECTURE_HOME_ID);
  }, [active, reloadUploads, selectDoc]);

  const onUploaded = useCallback(
    async (id) => {
      await reloadUploads();
      selectDoc(id);
    },
    [reloadUploads, selectDoc]
  );

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

      <div className={`ref-docs-body${navOpen ? ' is-nav-open' : ''}${isIndex ? ' is-html' : ''}`}>
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
            {visibleTree.map((p) => (
              <div
                key={p.product}
                className="ref-docs-nav__group"
                style={{ '--okd-product': productColor(p.product, LECTURE_PRODUCT_COLORS, DEFAULT_GROUP_COLOR) }}
              >
                <p className="ref-docs-nav__group-name">
                  <span className="ref-docs-nav__group-label">{p.product}</span>
                  <span className="ref-docs-nav__group-count">{p.docCount}</span>
                </p>
                {p.versions.map((v) => (
                  <div key={v.name} className="ref-docs-nav__version">
                    {v.version && (
                      <p className="ref-docs-nav__version-name">
                        {v.version}
                        <span className="ref-docs-nav__version-count">{v.docs.length}</span>
                      </p>
                    )}
                    <ul className="ref-docs-nav__list ref-docs-nav__list--guides">
                      {v.docs.map((d) => (
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
                    {isUploadedActive && (
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={purgeActive}>
                        완전 삭제
                      </button>
                    )}
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
                {isAdminShell && (
                  <LectureGuideUploadPanel groups={guideGroups.map((g) => g.name)} onUploaded={onUploaded} />
                )}
                {visibleTree
                  .flatMap((p) =>
                    p.versions.map((v) => ({
                      ...v,
                      color: productColor(p.product, LECTURE_PRODUCT_COLORS, DEFAULT_GROUP_COLOR),
                    }))
                  )
                  .map((g) => (
                    <section key={g.name} className="ref-docs-index__group">
                      <div className="ref-docs-index__group-head">
                        <span className="ref-docs-index__badge" style={{ '--okd-product': g.color }}>
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
            ) : !active ? (
              <p className="ref-docs-hidden-notice">문서를 불러오는 중입니다.</p>
            ) : activeHiddenForViewer ? null : isHtml ? (
              <>
                <p className="ref-docs-html-actions">
                  {!isUploadedActive && (
                    <a href={src} target="_blank" rel="noopener noreferrer">
                      새 탭에서 열기
                    </a>
                  )}
                  <button type="button" className="ref-docs-html-actions__btn" disabled={busy} onClick={downloadActive}>
                    HTML 다운로드
                  </button>
                  {!isAdminShell && actionError && <span className="ref-docs-admin-bar__error">{actionError}</span>}
                </p>
                {isUploadedActive && uploadedHtml.error && (
                  <p className="ref-docs-admin-bar__error">{uploadedHtml.error}</p>
                )}
                {isUploadedActive && uploadedHtml.id !== active.id ? (
                  !uploadedHtml.error && <p className="ref-docs-hidden-notice">가이드를 불러오는 중입니다.</p>
                ) : (
                <LectureGuideFrame
                  {...(isUploadedActive ? { srcDoc: uploadedHtml.html } : { src })}
                  title={active.title}
                  scrollEl={articleScrollEl}
                  onHeadings={setGuideHeadings}
                  onActiveChange={setGuideActiveId}
                  jumpRef={guideJumpRef}
                />
                )}
              </>
            ) : (
              <MarkdownDocViewer key={src} src={src} onHeadingsChange={onHeadingsChange} onDocSelect={selectDoc} />
            )}
          </div>
        </div>

        {!isIndex && (
          <aside className="ref-docs-toc-rail" aria-label="이 페이지 목차">
            <div className="ref-docs-toc-rail__inner">
              <p className="ref-docs-toc-rail__title">On this page</p>
              {isHtml ? (
                guideHeadings.length ? (
                  <nav className="doc-toc" aria-label="목차">
                    <ul className="doc-toc__list">
                      {guideHeadings.map((h) => (
                        <li
                          key={h.id}
                          className={`doc-toc__item doc-toc__item--h${h.level}${guideActiveId === h.id ? ' is-active' : ''}`}
                        >
                          <a
                            href={`#${h.id}`}
                            className="doc-toc__link"
                            onClick={(e) => {
                              e.preventDefault();
                              guideJumpRef.current?.(h.id);
                            }}
                          >
                            {h.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ) : (
                  <p className="doc-toc__empty">목차를 불러오는 중입니다.</p>
                )
              ) : (
                <DocTableOfContents headings={headings} scrollRoot={articleScrollEl} />
              )}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
