import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Pin,
  Plus,
  RefreshCcw,
  Save,
} from 'lucide-react';
import { isEditorMode } from '../utils/appMode.js';
import {
  ANNOUNCEMENT_CATEGORY_LIST,
  formatAnnouncementCategoryLabel,
  formatAnnouncementPublishLabel,
  sortAnnouncements,
} from '../constants/announcements.js';
import { useAnnouncements } from '../hooks/useAnnouncements.js';
import { resolveAnnouncementAuthorIdentity } from '../utils/announcementAuthorIdentity.js';
import SupabaseAuthControls from '../components/SupabaseAuthControls.jsx';
import './AnnouncementsPage.css';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return value;
  }
}

function statusClassName(isPublished) {
  return isPublished ? 'is-published' : 'is-unpublished';
}

function AnnouncementCard({
  announcement,
  draft,
  isManager = false,
  canEdit = false,
  saving = false,
  onDraftChange,
  onSave,
}) {
  const managerEditable = isManager && !saving;

  return (
    <article className={`announcement-card${announcement.isPinned ? ' is-pinned' : ''}`}>
      <div className="announcement-card__main">
        <div className="announcement-card__topline">
          <span className={`announcement-badge announcement-badge--${announcement.category}`}>
            [{formatAnnouncementCategoryLabel(announcement.category)}]
          </span>
          <span className={`announcement-status ${statusClassName(announcement.isPublished)}`}>
            {formatAnnouncementPublishLabel(announcement.isPublished)}
          </span>
          {announcement.isPinned && (
            <span className="announcement-status announcement-status--pin">
              <Pin size={12} aria-hidden />
              고정
            </span>
          )}
        </div>

        {managerEditable ? (
          <div className="announcement-card__editor">
            <label htmlFor={`announcement-title-${announcement.id}`}>제목</label>
            <input
              id={`announcement-title-${announcement.id}`}
              className="form-input"
              value={draft.title}
              onChange={(e) =>
                onDraftChange(announcement.id, {
                  ...draft,
                  title: e.target.value,
                })
              }
              disabled={!canEdit}
            />

            <label htmlFor={`announcement-body-${announcement.id}`}>본문</label>
            <textarea
              id={`announcement-body-${announcement.id}`}
              className="form-input announcement-card__textarea"
              rows={5}
              value={draft.body}
              onChange={(e) =>
                onDraftChange(announcement.id, {
                  ...draft,
                  body: e.target.value,
                })
              }
              disabled={!canEdit}
            />

            <div className="announcement-card__controls">
              <label htmlFor={`announcement-category-${announcement.id}`}>
                카테고리
              </label>
              <select
                id={`announcement-category-${announcement.id}`}
                className="form-input"
                value={draft.category}
                onChange={(e) =>
                  onDraftChange(announcement.id, {
                    ...draft,
                    category: e.target.value,
                  })
                }
                disabled={!canEdit}
              >
                {ANNOUNCEMENT_CATEGORY_LIST.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="announcement-card__toggles">
              <label className="announcement-toggle">
                <input
                  type="checkbox"
                  checked={draft.isPinned}
                  onChange={(e) =>
                    onDraftChange(announcement.id, {
                      ...draft,
                      isPinned: e.target.checked,
                    })
                  }
                  disabled={!canEdit}
                />
                <span>고정</span>
              </label>
              <label className="announcement-toggle">
                <input
                  type="checkbox"
                  checked={draft.isPublished}
                  onChange={(e) =>
                    onDraftChange(announcement.id, {
                      ...draft,
                      isPublished: e.target.checked,
                    })
                  }
                  disabled={!canEdit}
                />
                <span>공개</span>
              </label>
            </div>

            <button
              type="button"
              className="btn btn-primary announcement-card__save"
              onClick={() => onSave(announcement.id)}
              disabled={!managerEditable || !canEdit}
            >
              <Save size={14} />
              저장
            </button>
          </div>
        ) : (
          <>
            <h3>{announcement.title}</h3>
            <p className="announcement-card__body">{announcement.body}</p>
          </>
        )}

        <div className="announcement-card__meta">
          <span>작성자: {announcement.author}</span>
          <span>코드: {announcement.authorCode || '미지정'}</span>
          <span>작성일: {formatDate(announcement.createdAt)}</span>
          <span>수정일: {formatDate(announcement.updatedAt)}</span>
          {announcement.isPublished && announcement.publishedAt && (
            <span>공개일: {formatDate(announcement.publishedAt)}</span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AnnouncementsPage({
  readOnly = false,
  teamAccess = null,
  authorCode: authorCodeProp = null,
  authorName: authorNameProp = null,
}) {
  const isManager = Boolean(teamAccess?.isLeader && !teamAccess?.isMemberScope);
  const authorIdentity =
    authorCodeProp && authorNameProp
      ? { authorCode: authorCodeProp, authorName: authorNameProp }
      : resolveAnnouncementAuthorIdentity(teamAccess);
  const authorCode = authorIdentity.authorCode;
  const authorName = authorIdentity.authorName;
  const canEdit = isEditorMode() && !readOnly && isManager;

  const {
    announcements,
    loading,
    savingId,
    error,
    sourceStatus,
    summary,
    refresh,
    createAnnouncement,
    updateAnnouncement,
  } = useAnnouncements({ authorCode, authorName, canManage: isManager });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('notice');
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts((prev) => {
      const next = {};
      announcements.forEach((announcement) => {
        next[announcement.id] = prev[announcement.id] || {
          title: announcement.title,
          body: announcement.body,
          category: announcement.category,
          isPinned: announcement.isPinned,
          isPublished: announcement.isPublished,
        };
      });
      return next;
    });
  }, [announcements]);

  const visibleAnnouncements = useMemo(() => sortAnnouncements(announcements), [announcements]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit) {
      setMessage('공지 등록은 관리자/팀장만 가능합니다.');
      return;
    }

    const result = await createAnnouncement({
      title,
      body,
      category,
      isPinned,
      isPublished,
      author: authorName,
      authorCode,
    });

    if (!result.ok) {
      setMessage(result.message || '공지 등록에 실패했습니다.');
      return;
    }

    setTitle('');
    setBody('');
    setCategory('notice');
    setIsPinned(false);
    setIsPublished(true);
    setMessage('공지사항이 등록되었습니다.');
  };

  const handleManagerSave = async (announcementId) => {
    const draft = drafts[announcementId];
    const announcement = announcements.find((item) => item.id === announcementId);
    if (!draft || !announcement) return;

    const result = await updateAnnouncement(announcementId, {
      title: draft.title,
      body: draft.body,
      category: draft.category,
      isPinned: draft.isPinned,
      isPublished: draft.isPublished,
    });

    if (!result.ok) {
      setMessage(result.message || '공지 상태를 저장하지 못했습니다.');
      return;
    }
    setMessage('공지사항이 저장되었습니다.');
  };

  const summaryCards = [
    ['공개 공지', summary.totalPublished],
    ['고정 공지', summary.pinnedPublished],
    ['최근 업데이트', summary.recentPublished],
  ];

  return (
    <main className="announcements-page">
      <header className="announcements-header">
        <div className="announcements-header__title">
          <Bell size={18} aria-hidden />
          <div>
            <h2>공지사항</h2>
            <p>앱 공지, 업데이트 내역, 장애 안내, 사용 안내를 한곳에서 관리합니다.</p>
          </div>
        </div>
        <div className="announcements-header__meta">
          <strong>작성자 {authorName}</strong>
          <span>{isManager ? '관리자·팀장 모드' : '구성원 조회 모드'}</span>
        </div>
      </header>

      <section className="announcements-summary">
        <div className="announcements-summary__grid">
          {summaryCards.map(([label, value]) => (
            <article key={label} className="announcements-summary__card">
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <div className="announcements-summary__sub">
          <span>기준: 공개 공지만 집계</span>
          <span>최근 업데이트: 7일</span>
          <span>
            {sourceStatus === 'disabled'
              ? 'Supabase 미설정'
              : sourceStatus === 'error'
                ? 'Supabase 오류'
                : 'Supabase 연결 확인'}
          </span>
        </div>
      </section>

      <section className="announcements-panel">
        {!canEdit && (
          <p className="announcements-note">
            구성원은 공개된 공지만 볼 수 있습니다. 등록과 수정은 관리자/팀장만 가능합니다.
          </p>
        )}
        {error && (
          <p className="announcements-alert announcements-alert--warning">
            <AlertTriangle size={14} aria-hidden />
            {error}
          </p>
        )}
        {message && (
          <p className="announcements-message">
            <CheckCircle2 size={14} aria-hidden />
            {message}
          </p>
        )}

        {isManager && (
          <div className="announcements-auth-panel">
            <SupabaseAuthControls
              className="project-supabase-auth--page"
              inputId="announcements-supabase-auth-email"
              helpId="announcements-supabase-auth-help"
            />
          </div>
        )}

        {canEdit && (
          <form className="announcements-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="announcement-title">제목</label>
              <input
                id="announcement-title"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 7월 1주차 릴리즈 노트"
                maxLength={120}
                disabled={!canEdit}
              />
            </div>
            <div className="form-group">
              <label htmlFor="announcement-category">카테고리</label>
              <select
                id="announcement-category"
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!canEdit}
              >
                {ANNOUNCEMENT_CATEGORY_LIST.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group announcements-form__wide">
              <label htmlFor="announcement-body">본문</label>
              <textarea
                id="announcement-body"
                className="form-input announcements-textarea"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="공지 내용, 변경 사항, 장애 안내, 사용 방법을 적어 주세요."
                maxLength={4000}
                disabled={!canEdit}
              />
            </div>
            <label className="announcement-toggle announcements-form__toggle">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                disabled={!canEdit}
              />
              <span>고정</span>
            </label>
            <label className="announcement-toggle announcements-form__toggle">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                disabled={!canEdit}
              />
              <span>공개</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={!canEdit || savingId !== null}>
              <Plus size={14} />
              공지 등록
            </button>
            <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}>
              <RefreshCcw size={14} />
              새로고침
            </button>
          </form>
        )}
      </section>

      <section className="announcements-list">
        {loading ? (
          <div className="announcements-empty">공지사항을 불러오는 중입니다.</div>
        ) : visibleAnnouncements.length === 0 ? (
          <div className="announcements-empty">아직 등록된 공지가 없습니다.</div>
        ) : (
          visibleAnnouncements.map((announcement) => {
            const draft = drafts[announcement.id] || {
              title: announcement.title,
              body: announcement.body,
              category: announcement.category,
              isPinned: announcement.isPinned,
              isPublished: announcement.isPublished,
            };

            return (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                draft={draft}
                isManager={isManager}
                canEdit={canEdit}
                saving={savingId === announcement.id}
                onDraftChange={(announcementId, nextDraft) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [announcementId]: nextDraft,
                  }))
                }
                onSave={handleManagerSave}
              />
            );
          })
        )}
      </section>
    </main>
  );
}
