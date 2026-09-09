import React, { useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  Check,
  Database,
  ExternalLink,
  Filter,
  Layers,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { marked } from 'marked';
import { generateSlug, useGlossary } from '../hooks/useGlossary.js';
import { autoLinkGlossaryHtml } from '../utils/glossaryLinker.js';
import { isEditorMode } from '../utils/appMode.js';
import './GlossaryPage.css';

const CATEGORY_MAP = {
  all: { label: '전체', color: 'cat-all' },
  topic: { label: '주제 (Topics)', color: 'cat-topic' },
  hub: { label: 'AI 소스 기지 (Hubs)', color: 'cat-hub' },
  story: { label: '실전 사례 (Stories)', color: 'cat-story' },
};

export default function GlossaryPage({
  readOnly = false,
  teamAccess = null,
  isAdminShell = false,
}) {
  const isManager = Boolean(teamAccess?.isLeader && !teamAccess?.isMemberScope);
  const canManage = !readOnly && (isAdminShell || (isEditorMode() && isManager));

  const {
    terms,
    loading,
    saving,
    error,
    sourceStatus,
    refresh,
    createTerm,
    updateTerm,
    deleteTerm,
    resetToSeed,
  } = useGlossary();

  const [selectedSlug, setSelectedSlug] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('slug') || p.get('term') || null;
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTag, setSelectedTag] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const handleSelectSlug = (slug) => {
    setSelectedSlug(slug);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (slug) {
        url.searchParams.set('slug', slug);
      } else {
        url.searchParams.delete('slug');
      }
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search);
        const urlSlug = p.get('slug') || p.get('term');
        if (urlSlug) setSelectedSlug(urlSlug);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCategory, setFormCategory] = useState('topic');
  const [formSourceUrl, setFormSourceUrl] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formRelated, setFormRelated] = useState([]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set();
    terms.forEach((term) => {
      (term.tags || []).forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [terms]);

  // Filtered terms
  const filteredTerms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return terms.filter((term) => {
      if (selectedCategory !== 'all' && term.category !== selectedCategory) {
        return false;
      }
      if (selectedTag && !(term.tags || []).includes(selectedTag)) {
        return false;
      }
      if (!q) return true;
      const matchTitle = term.title.toLowerCase().includes(q);
      const matchSlug = term.slug.toLowerCase().includes(q);
      const matchTags = (term.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchBody = term.body.toLowerCase().includes(q);
      return matchTitle || matchSlug || matchTags || matchBody;
    });
  }, [terms, searchQuery, selectedCategory, selectedTag]);

  // Auto-select first item if current selection invalid
  useEffect(() => {
    if (filteredTerms.length > 0) {
      if (!selectedSlug || !terms.some((t) => t.slug === selectedSlug)) {
        handleSelectSlug(filteredTerms[0].slug);
      }
    }
  }, [filteredTerms, selectedSlug, terms]);

  const currentTerm = useMemo(() => {
    return terms.find((t) => t.slug === selectedSlug) || null;
  }, [terms, selectedSlug]);

  const parsedMarkdown = useMemo(() => {
    if (!currentTerm?.body) return '';
    try {
      const rawHtml = marked.parse(currentTerm.body);
      return autoLinkGlossaryHtml(rawHtml, terms, currentTerm.slug);
    } catch {
      return currentTerm.body;
    }
  }, [currentTerm, terms]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingTerm(null);
    setFormTitle('');
    setFormSlug('');
    setFormCategory('topic');
    setFormSourceUrl('');
    setFormTags('');
    setFormBody('');
    setFormRelated([]);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (term) => {
    setEditingTerm(term);
    setFormTitle(term.title);
    setFormSlug(term.slug);
    setFormCategory(term.category || 'topic');
    setFormSourceUrl(term.sourceUrl || '');
    setFormTags((term.tags || []).join(', '));
    setFormBody(term.body || '');
    setFormRelated(term.related || []);
    setModalOpen(true);
  };

  const handleTitleChange = (val) => {
    setFormTitle(val);
    if (!editingTerm) {
      setFormSlug(generateSlug(val));
    }
  };

  const handleSaveTerm = async (e) => {
    e.preventDefault();
    const tagsArr = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: formTitle.trim(),
      slug: formSlug.trim(),
      category: formCategory,
      sourceUrl: formSourceUrl.trim() || null,
      tags: tagsArr,
      body: formBody.trim(),
      related: formRelated,
    };

    if (editingTerm) {
      const res = await updateTerm(editingTerm.slug, payload);
      if (res.ok) {
        showToast('용어가 수정되었습니다.');
        setModalOpen(false);
      } else {
        alert(res.message);
      }
    } else {
      const res = await createTerm(payload);
      if (res.ok) {
        showToast('새 용어가 등록되었습니다.');
        setSelectedSlug(res.data.slug);
        setModalOpen(false);
      } else {
        alert(res.message);
      }
    }
  };

  const handleDeleteTerm = async (term) => {
    if (!window.confirm(`「${term.title}」 용어를 정말 삭제하시겠습니까?`)) {
      return;
    }
    const res = await deleteTerm(term.slug);
    if (res.ok) {
      showToast('용어가 삭제되었습니다.');
    } else {
      alert(res.message);
    }
  };

  const handleResetToSeed = async () => {
    if (
      !window.confirm(
        'AI-Synapse Wiki의 초기 16개 표준 용어 데이터로 복원하시겠습니까?'
      )
    ) {
      return;
    }
    const res = await resetToSeed();
    if (res.ok) {
      showToast('초기 용어 데이터가 복원되었습니다.');
      refresh();
    }
  };

  const handleBodyClick = (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const slugAttr = link.getAttribute('data-glossary-slug');
    let targetSlug = slugAttr;

    if (!targetSlug && href.startsWith('#')) {
      targetSlug = href.slice(1);
    } else if (!targetSlug && !href.startsWith('http://') && !href.startsWith('https://')) {
      if (href.includes('slug=')) {
        try {
          targetSlug = new URL(href, window.location.origin).searchParams.get('slug');
        } catch {
          targetSlug = null;
        }
      } else if (!href.includes('/')) {
        targetSlug = href;
      }
    }

    if (targetSlug) {
      const targetTerm = terms.find((t) => t.slug.toLowerCase() === targetSlug.toLowerCase());
      if (targetTerm) {
        e.preventDefault();
        handleSelectSlug(targetTerm.slug);
        const panel = document.querySelector('.glossary-detail-panel');
        if (panel) {
          panel.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
    }

    if (href.startsWith('http://') || href.startsWith('https://')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer noopener');
    }
  };

  return (
    <div className="glossary-page">
      {/* Toast */}
      {toastMsg && <div className="glossary-toast">{toastMsg}</div>}

      {/* Header */}
      <header className="glossary-header">
        <div className="glossary-header__left">
          <div className="glossary-header__title-row">
            <BookMarked className="glossary-header__icon" size={24} />
            <h1 className="glossary-header__title">용어사전</h1>
            <span className="glossary-header__subtitle">AI-Synapse Wiki 지식 허브</span>
          </div>
          <div className="glossary-meta-badges">
            <span className="glossary-meta-badge">
              등록 용어 <strong>{terms.length}</strong>건
            </span>
            <span className={`glossary-meta-badge glossary-meta-badge--${sourceStatus}`}>
              <Database size={13} />
              {sourceStatus === 'supabase'
                ? 'Supabase 클라우드 동기화'
                : sourceStatus === 'empty-remote'
                ? '원격(빈 저장소)'
                : '로컬/캐시 보관'}
            </span>
          </div>
        </div>

        <div className="glossary-header__actions">
          <button
            type="button"
            className="glossary-btn glossary-btn--ghost"
            onClick={refresh}
            title="새로고침"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'is-spinning' : ''} />
            새로고침
          </button>
          {canManage && (
            <>
              <button
                type="button"
                className="glossary-btn glossary-btn--ghost"
                onClick={handleResetToSeed}
                title="초기 데이터 복원"
              >
                <RotateCcw size={15} />
                초기 복원
              </button>
              <button
                type="button"
                className="glossary-btn glossary-btn--primary"
                onClick={handleOpenAdd}
              >
                <Plus size={16} />새 용어 등록
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mascot Cheer Banner (Stitch Style) */}
      <div className="glossary-mascot-banner">
        <div className="glossary-mascot-card">
          <img
            src="/okestro-bear-mascot.png"
            alt="오케 곰돌이 마스코트"
            className="glossary-mascot-img"
          />
        </div>
        <div className="glossary-mascot-bubble">
          <div className="glossary-mascot-bubble-badge-row">
            <span className="glossary-mascot-pill-badge">꿀팁 마스코트 🍯</span>
            <span className="glossary-mascot-pill-sub">응원 파워 100% ✨</span>
          </div>
          <p className="glossary-mascot-text">
            <strong>용어 사전에서 핵심 인사이트를 찾아볼까요?</strong> AI·클라우드 실무 용어 속에 스마트한 정답이 숨어있어요! 🍯💛
          </p>
        </div>
      </div>

      {/* Controls: Search & Category Tabs */}
      <div className="glossary-controls">
        <div className="glossary-search-box">
          <Search size={16} className="glossary-search-box__icon" />
          <input
            type="text"
            className="glossary-search-box__input"
            placeholder="용어 검색 (제목, 본문, 태그, 영문 식별자)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="glossary-search-box__clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="glossary-category-tabs" role="tablist">
          {Object.entries(CATEGORY_MAP).map(([key, item]) => (
            <button
              key={key}
              type="button"
              className={`glossary-category-tab ${item.color}${selectedCategory === key ? ' is-active' : ''}`}
              onClick={() => setSelectedCategory(key)}
            >
              {item.label}
              {key !== 'all' && (
                <span className="glossary-category-tab__count">
                  {terms.filter((t) => t.category === key).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="glossary-tags-bar">
          <span className="glossary-tags-bar__label">
            <Tag size={13} /> 태그:
          </span>
          <button
            type="button"
            className={`glossary-tag-chip${!selectedTag ? ' is-active' : ''}`}
            onClick={() => setSelectedTag('')}
          >
            전체
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`glossary-tag-chip${selectedTag === tag ? ' is-active' : ''}`}
              onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Main Split Layout */}
      <div className="glossary-main-layout">
        {/* Left: Term List */}
        <aside className="glossary-list-panel">
          <div className="glossary-list-panel__head">
            <span className="glossary-list-panel__count">
              검색 결과 <strong>{filteredTerms.length}</strong>개
            </span>
          </div>

          <div className="glossary-card-list">
            {filteredTerms.length === 0 ? (
              <div className="glossary-empty">
                <p>일치하는 용어가 없습니다.</p>
              </div>
            ) : (
              filteredTerms.map((term) => {
                const isSelected = term.slug === selectedSlug;
                const catInfo = CATEGORY_MAP[term.category] || CATEGORY_MAP.topic;
                return (
                  <article
                    key={term.slug}
                    className={`glossary-card${isSelected ? ' is-selected' : ''}`}
                    onClick={() => handleSelectSlug(term.slug)}
                  >
                    <div className="glossary-card__head">
                      <h3 className="glossary-card__title">{term.title}</h3>
                      <span className={`glossary-card__category ${catInfo.color}`}>
                        {catInfo.label.split(' ')[0]}
                      </span>
                    </div>

                    <div className="glossary-card__slug">
                      <code>{term.slug}</code>
                    </div>

                    {term.tags && term.tags.length > 0 && (
                      <div className="glossary-card__tags">
                        {term.tags.map((tg) => (
                          <span key={tg} className="glossary-mini-tag">
                            #{tg}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="glossary-card__excerpt">
                      {term.body.replace(/[#*`_\[\]]/g, '').slice(0, 110)}…
                    </p>

                    {term.related && term.related.length > 0 && (
                      <div className="glossary-card__footer">
                        <span className="glossary-card__related-count">
                          <Network size={12} /> 연관 {term.related.length}개
                        </span>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </aside>

        {/* Right: Term Detail View */}
        <main className="glossary-detail-panel">
          {currentTerm ? (
            <div className="glossary-detail-container">
              <div className="glossary-detail__header">
                <div className="glossary-detail__title-box">
                  <div className="glossary-detail__category-badge">
                    {CATEGORY_MAP[currentTerm.category]?.label || currentTerm.category}
                  </div>
                  <h2 className="glossary-detail__title">{currentTerm.title}</h2>
                  <div className="glossary-detail__slug-row">
                    <span className="glossary-detail__slug-label">고유 식별자:</span>
                    <code className="glossary-detail__slug">{currentTerm.slug}</code>
                    {currentTerm.sourceUrl && (
                      <a
                        href={currentTerm.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="glossary-detail__source-link"
                      >
                        <ExternalLink size={13} />
                        출처 원문 방문
                      </a>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="glossary-detail__actions">
                    <button
                      type="button"
                      className="glossary-btn glossary-btn--outline"
                      onClick={() => handleOpenEdit(currentTerm)}
                    >
                      <Pencil size={14} />
                      수정
                    </button>
                    <button
                      type="button"
                      className="glossary-btn glossary-btn--danger"
                      onClick={() => handleDeleteTerm(currentTerm)}
                    >
                      <Trash2 size={14} />
                      삭제
                    </button>
                  </div>
                )}
              </div>

              {/* Tags */}
              {currentTerm.tags && currentTerm.tags.length > 0 && (
                <div className="glossary-detail__tags">
                  {currentTerm.tags.map((tag) => (
                    <span
                      key={tag}
                      className="glossary-tag-chip is-active"
                      onClick={() => setSelectedTag(tag)}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Synapse: Related Terms */}
              {currentTerm.related && currentTerm.related.length > 0 && (
                <div className="glossary-synapse-box">
                  <div className="glossary-synapse-box__label">
                    <Network size={16} />
                    <span>연관 지식 네트워크 (Synapse)</span>
                  </div>
                  <div className="glossary-synapse-box__links">
                    {currentTerm.related.map((relSlug) => {
                      const relTerm = terms.find((t) => t.slug === relSlug);
                      return (
                        <button
                          key={relSlug}
                          type="button"
                          className="glossary-synapse-pill"
                          onClick={() => handleSelectSlug(relSlug)}
                        >
                          <span className="glossary-synapse-pill__name">
                            {relTerm ? relTerm.title : relSlug}
                          </span>
                          <span className="glossary-synapse-pill__arrow">→</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Body: Markdown rendering */}
              <div
                className="glossary-detail__body markdown-body"
                dangerouslySetInnerHTML={{ __html: parsedMarkdown }}
                onClick={handleBodyClick}
              />

              <div className="glossary-detail__footer">
                <span>
                  갱신일: {new Date(currentTerm.updatedAt).toLocaleDateString('ko-KR')}
                </span>
                <span>
                  출처: {currentTerm.sourceUrl ? new URL(currentTerm.sourceUrl).hostname : '내부 지식'}
                </span>
              </div>
            </div>
          ) : (
            <div className="glossary-detail__placeholder">
              <BookMarked size={48} />
              <p>용어를 선택하여 상세 내용을 확인하세요.</p>
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="glossary-modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="glossary-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="glossary-modal-header">
              <h3>{editingTerm ? '용어 수정' : '새 용어 등록'}</h3>
              <button
                type="button"
                className="glossary-modal-close"
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form className="glossary-modal-form" onSubmit={handleSaveTerm}>
              <div className="glossary-form-group">
                <label>용어 제목 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: Google Gemini, Streaming Multiprocessor"
                  value={formTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
              </div>

              <div className="glossary-form-row">
                <div className="glossary-form-group">
                  <label>고유 식별자 (Slug) *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: gemini, streaming-multiprocessor"
                    value={formSlug}
                    disabled={Boolean(editingTerm)}
                    onChange={(e) => setFormSlug(e.target.value)}
                  />
                  {editingTerm && (
                    <span className="glossary-form-hint">
                      식별자는 연관 링크 보호를 위해 수정할 수 없습니다.
                    </span>
                  )}
                </div>

                <div className="glossary-form-group">
                  <label>카테고리</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="topic">주제 (Topic)</option>
                    <option value="hub">AI 소스 기지 (Hub)</option>
                    <option value="story">실전 사례 (Story)</option>
                  </select>
                </div>
              </div>

              <div className="glossary-form-group">
                <label>출처 URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formSourceUrl}
                  onChange={(e) => setFormSourceUrl(e.target.value)}
                />
              </div>

              <div className="glossary-form-group">
                <label>태그 (쉼표로 구분)</label>
                <input
                  type="text"
                  placeholder="agent, cli, rag, hardware"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                />
              </div>

              {/* Related Terms Multi-select Checklist */}
              <div className="glossary-form-group">
                <label>연관 용어 연결 (Synapse)</label>
                <div className="glossary-related-checklist">
                  {terms
                    .filter((t) => t.slug !== formSlug)
                    .map((t) => {
                      const isChecked = formRelated.includes(t.slug);
                      return (
                        <label key={t.slug} className="glossary-related-item">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormRelated((prev) => [...prev, t.slug]);
                              } else {
                                setFormRelated((prev) =>
                                  prev.filter((slug) => slug !== t.slug)
                                );
                              }
                            }}
                          />
                          <span>{t.title}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="glossary-form-group">
                <label>본문 내용 (마크다운) *</label>
                <textarea
                  required
                  rows={10}
                  placeholder="# 개요&#10;&#10;핵심 설명 및 표, 링크를 작성하세요..."
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                />
              </div>

              <div className="glossary-modal-actions">
                <button
                  type="button"
                  className="glossary-btn glossary-btn--ghost"
                  onClick={() => setModalOpen(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="glossary-btn glossary-btn--primary"
                  disabled={saving}
                >
                  {saving ? '저장 중…' : editingTerm ? '수정 완료' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
