import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Pin,
  Plus,
  RefreshCcw,
  Save,
} from 'lucide-react';
import { isEditorMode } from '../utils/appMode.js';
import {
  ANNOUNCEMENT_CATEGORY_LIST,
  ANNOUNCEMENT_COMMENT_MAX_LENGTH,
  ANNOUNCEMENT_REACTION_EMOJIS,
  DEFAULT_ANNOUNCEMENT_CATEGORY,
  formatAnnouncementCategoryLabel,
  formatAnnouncementPublishLabel,
  groupAnnouncementsByFeedDay,
  sortAnnouncements,
} from '../constants/announcements.js';
import { buildDocsModuleUrl } from '../constants/referenceDocs.js';
import { useAnnouncements } from '../hooks/useAnnouncements.js';
import { resolveAnnouncementAuthorIdentity } from '../utils/announcementAuthorIdentity.js';
import {
  createAnnouncementComment,
  deleteAnnouncementComment,
  fetchAnnouncementComments,
  fetchAnnouncementReactions,
  toggleAnnouncementReaction,
} from '../utils/announcementEngagementApi.js';
import { markAnnouncementsSeen } from '../utils/announcementsUnreadBadge.js';
import './AnnouncementsPage.css';

function formatDateTime(value) {
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

function AnnouncementBody({ body }) {
  return <div className="announcement-entry__body">{body || ''}</div>;
}

function AnnouncementEngagement({
  announcementId,
  reactions = {},
  comments = [],
  commentsOpen = false,
  commentDraft = '',
  canEngage = false,
  isManager = false,
  memberCode = '',
  busy = false,
  onToggleReaction,
  onToggleComments,
  onCommentDraftChange,
  onSubmitComment,
  onDeleteComment,
}) {
  return (
    <div className="announcement-engagement">
      <div className="announcement-reactions" role="group" aria-label="이모지 반응">
        {ANNOUNCEMENT_REACTION_EMOJIS.map((emoji) => {
          const stat = reactions[emoji] || { count: 0, mine: false };
          return (
            <button
              key={emoji}
              type="button"
              className={`announcement-reaction-btn${stat.mine ? ' is-mine' : ''}`}
              disabled={!canEngage || busy}
              aria-pressed={stat.mine}
              onClick={() => onToggleReaction?.(announcementId, emoji)}
              title={canEngage ? `${emoji} 반응` : '조회 모드에서는 반응할 수 없습니다'}
            >
              <span aria-hidden>{emoji}</span>
              {stat.count > 0 ? <span className="announcement-reaction-btn__count">{stat.count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="announcement-comments">
        <button
          type="button"
          className="announcement-comments__toggle"
          aria-expanded={commentsOpen}
          onClick={() => onToggleComments?.(announcementId)}
        >
          댓글 {comments.length}
          <ChevronDown
            size={14}
            className={`announcement-comments__chevron${commentsOpen ? ' is-open' : ''}`}
            aria-hidden
          />
        </button>
        {commentsOpen && (
          <div className="announcement-comments__panel">
            {comments.length === 0 ? (
              <p className="announcement-comments__empty">아직 댓글이 없습니다.</p>
            ) : (
              <ul className="announcement-comments__list">
                {comments.map((comment) => {
                  const canDelete =
                    canEngage && (isManager || comment.memberCode === memberCode);
                  return (
                    <li key={comment.id} className="announcement-comments__item">
                      <div className="announcement-comments__meta">
                        <strong>{comment.author}</strong>
                        <span>{formatDateTime(comment.createdAt)}</span>
                      </div>
                      <p className="announcement-comments__body">{comment.body}</p>
                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-ghost announcement-comments__delete"
                          disabled={busy}
                          onClick={() => onDeleteComment?.(announcementId, comment.id)}
                        >
                          삭제
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEngage && (
              <form
                className="announcement-comments__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmitComment?.(announcementId);
                }}
              >
                <textarea
                  className="form-input announcements-textarea"
                  rows={2}
                  maxLength={ANNOUNCEMENT_COMMENT_MAX_LENGTH}
                  value={commentDraft}
                  disabled={busy}
                  placeholder="짧은 댓글을 남겨 주세요"
                  onChange={(e) => onCommentDraftChange?.(announcementId, e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !commentDraft.trim()}>
                  댓글 등록
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnnouncementEntry({
  announcement,
  draft,
  isManager = false,
  canEdit = false,
  saving = false,
  editing = false,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
  engagement = null,
}) {
  const managerEditable = isManager && canEdit && !saving;

  return (
    <article
      className={`announcement-entry${announcement.isPinned ? ' is-pinned' : ''}${
        editing ? ' is-editing' : ''
      }`}
    >
      <div className="announcement-entry__topline">
        <span className={`announcement-badge announcement-badge--${announcement.category}`}>
          {formatAnnouncementCategoryLabel(announcement.category)}
        </span>
        {isManager && (
          <span className={`announcement-status ${statusClassName(announcement.isPublished)}`}>
            {formatAnnouncementPublishLabel(announcement.isPublished)}
          </span>
        )}
        {announcement.isPinned && (
          <span className="announcement-status announcement-status--pin">
            <Pin size={12} aria-hidden />
            고정
          </span>
        )}
      </div>

      {editing && managerEditable ? (
        <div className="announcement-entry__editor">
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
          />

          <label htmlFor={`announcement-body-${announcement.id}`}>본문</label>
          <textarea
            id={`announcement-body-${announcement.id}`}
            className="form-input announcement-entry__textarea"
            rows={6}
            value={draft.body}
            onChange={(e) =>
              onDraftChange(announcement.id, {
                ...draft,
                body: e.target.value,
              })
            }
            placeholder={'- 변경 사항 한 줄\n- 영향 범위'}
          />

          <div className="announcement-entry__controls">
            <label htmlFor={`announcement-category-${announcement.id}`}>카테고리</label>
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
            >
              {ANNOUNCEMENT_CATEGORY_LIST.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="announcement-entry__toggles">
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
              />
              <span>공개</span>
            </label>
          </div>

          <div className="announcement-entry__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onSave(announcement.id)}
              disabled={saving}
            >
              <Save size={14} />
              저장
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancelEdit} disabled={saving}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="announcement-entry__title">{announcement.title}</h3>
          <AnnouncementBody body={announcement.body} />
          <div className="announcement-entry__meta">
            <span>{announcement.author}</span>
            {announcement.isPublished && announcement.publishedAt ? (
              <span>공개 {formatDateTime(announcement.publishedAt)}</span>
            ) : (
              <span>작성 {formatDateTime(announcement.createdAt)}</span>
            )}
            {announcement.updatedAt && announcement.updatedAt !== announcement.publishedAt && (
              <span>수정 {formatDateTime(announcement.updatedAt)}</span>
            )}
          </div>
          {managerEditable && (
            <div className="announcement-entry__actions">
              <button type="button" className="btn btn-ghost" onClick={() => onStartEdit(announcement.id)}>
                수정
              </button>
            </div>
          )}
          {engagement}
        </>
      )}
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
  const canEngage = isEditorMode() && !readOnly && Boolean(authorCode);
  const releaseNotesUrl = buildDocsModuleUrl('tms-release');

  const {
    announcements,
    loading,
    savingId,
    error,
    sourceStatus,
    refresh,
    createAnnouncement,
    updateAnnouncement,
  } = useAnnouncements({ authorCode, authorName, canManage: isManager });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState(DEFAULT_ANNOUNCEMENT_CATEGORY);
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [reactionsById, setReactionsById] = useState({});
  const [commentsById, setCommentsById] = useState({});
  const [commentsOpenById, setCommentsOpenById] = useState({});
  const [commentDraftById, setCommentDraftById] = useState({});
  const [engagementBusyId, setEngagementBusyId] = useState(null);

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

  useEffect(() => {
    if (loading) return;
    markAnnouncementsSeen();
  }, [loading, announcements]);

  useEffect(() => {
    if (loading) return;
    const ids = announcements.map((item) => item.id).filter(Boolean);
    if (ids.length === 0) {
      setReactionsById({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await fetchAnnouncementReactions(ids, authorCode);
      if (cancelled || !result.ok) return;
      setReactionsById(result.data || {});
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, announcements, authorCode]);

  const visibleAnnouncements = useMemo(() => sortAnnouncements(announcements), [announcements]);
  const feedGroups = useMemo(
    () => groupAnnouncementsByFeedDay(visibleAnnouncements),
    [visibleAnnouncements]
  );

  const handleToggleReaction = async (announcementId, emoji) => {
    if (!canEngage) return;
    setEngagementBusyId(announcementId);
    const result = await toggleAnnouncementReaction({
      announcementId,
      memberCode: authorCode,
      emoji,
    });
    setEngagementBusyId(null);
    if (!result.ok) {
      setMessage(result.message || '반응을 저장하지 못했습니다.');
      return;
    }
    setReactionsById((prev) => ({
      ...prev,
      [announcementId]: result.data || {},
    }));
  };

  const handleToggleComments = async (announcementId) => {
    const nextOpen = !commentsOpenById[announcementId];
    setCommentsOpenById((prev) => ({ ...prev, [announcementId]: nextOpen }));
    if (!nextOpen || commentsById[announcementId]) return;
    setEngagementBusyId(announcementId);
    const result = await fetchAnnouncementComments(announcementId);
    setEngagementBusyId(null);
    if (!result.ok) {
      setMessage(result.message || '댓글을 불러오지 못했습니다.');
      return;
    }
    setCommentsById((prev) => ({ ...prev, [announcementId]: result.data }));
  };

  const handleSubmitComment = async (announcementId) => {
    if (!canEngage) return;
    const text = String(commentDraftById[announcementId] || '').trim();
    if (!text) return;
    setEngagementBusyId(announcementId);
    const result = await createAnnouncementComment({
      announcementId,
      memberCode: authorCode,
      author: authorName,
      body: text,
    });
    setEngagementBusyId(null);
    if (!result.ok) {
      setMessage(result.message || '댓글 등록에 실패했습니다.');
      return;
    }
    setCommentDraftById((prev) => ({ ...prev, [announcementId]: '' }));
    setCommentsById((prev) => ({
      ...prev,
      [announcementId]: [...(prev[announcementId] || []), result.data],
    }));
  };

  const handleDeleteComment = async (announcementId, commentId) => {
    if (!canEngage) return;
    setEngagementBusyId(announcementId);
    const result = await deleteAnnouncementComment({
      commentId,
      memberCode: authorCode,
    });
    setEngagementBusyId(null);
    if (!result.ok) {
      setMessage(result.message || '댓글 삭제에 실패했습니다.');
      return;
    }
    setCommentsById((prev) => ({
      ...prev,
      [announcementId]: (prev[announcementId] || []).filter((item) => item.id !== commentId),
    }));
  };

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
    setCategory(DEFAULT_ANNOUNCEMENT_CATEGORY);
    setIsPinned(false);
    setIsPublished(true);
    setComposeOpen(false);
    setMessage('업데이트가 등록되었습니다.');
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
    setEditingId(null);
    setMessage('업데이트가 저장되었습니다.');
  };

  return (
    <main className="announcements-page">
      <header className="announcements-header">
        <div className="announcements-header__title">
          <Bell size={18} aria-hidden />
          <div>
            <h2>업데이트 · 공지</h2>
            <p>
              앱 변경 사항과 안내를 시간순으로 확인합니다.{' '}
              <a
                className="announcements-header__doc-link"
                href={releaseNotesUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                전체 이력(참고문서 릴리즈 노트)
                <ExternalLink size={12} aria-hidden />
              </a>
            </p>
          </div>
        </div>
        <div className="announcements-header__meta">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={refresh}
            disabled={loading}
            aria-label="공지 새로고침"
          >
            <RefreshCcw size={14} />
            새로고침
          </button>
          <span>
            {sourceStatus === 'disabled'
              ? 'Supabase 미설정'
              : sourceStatus === 'error'
                ? 'Supabase 오류'
                : isManager
                  ? '관리자·팀장'
                  : '구성원'}
          </span>
        </div>
      </header>

      {(error || message || (!canEdit && !isManager)) && (
        <section className="announcements-status">
          {!canEdit && !isManager && (
            <p className="announcements-note">공개된 업데이트만 표시됩니다.</p>
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
        </section>
      )}

      {canEdit && (
        <section className="announcements-compose">
          <button
            type="button"
            className="announcements-compose__toggle"
            aria-expanded={composeOpen}
            onClick={() => setComposeOpen((open) => !open)}
          >
            <span>
              <Plus size={14} aria-hidden />
              새 업데이트 작성
            </span>
            <ChevronDown
              size={16}
              className={`announcements-compose__chevron${composeOpen ? ' is-open' : ''}`}
              aria-hidden
            />
          </button>
          {composeOpen && (
            <form className="announcements-form" onSubmit={handleSubmit}>
              <div className="announcements-form__toolbar">
                <p className="announcements-note">
                  /admin 비밀번호 세션으로 저장됩니다. Supabase 로그인은 필요하지 않습니다.
                </p>
                <div className="form-group announcements-form__category">
                  <label htmlFor="announcement-category">카테고리</label>
                  <select
                    id="announcement-category"
                    className="form-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {ANNOUNCEMENT_CATEGORY_LIST.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="announcement-title">제목</label>
                <input
                  id="announcement-title"
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026-07-09 — 일지 Supabase 미러 파일럿"
                  maxLength={120}
                />
              </div>
              <div className="form-group">
                <label htmlFor="announcement-body">본문</label>
                <textarea
                  id="announcement-body"
                  className="form-input announcements-textarea"
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={'- 변경 요약\n- 구성원 영향\n- 확인 방법'}
                  maxLength={4000}
                />
              </div>
              <div className="announcements-form__actions">
                <label className="announcement-toggle">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                  />
                  <span>고정</span>
                </label>
                <label className="announcement-toggle">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                  />
                  <span>공개</span>
                </label>
                <button type="submit" className="btn btn-primary" disabled={savingId !== null}>
                  <Plus size={14} />
                  등록
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section className="announcements-feed" aria-label="업데이트 타임라인">
        {loading ? (
          <div className="announcements-empty">업데이트를 불러오는 중입니다.</div>
        ) : feedGroups.length === 0 ? (
          <div className="announcements-empty">아직 등록된 업데이트가 없습니다.</div>
        ) : (
          feedGroups.map((group) => (
            <div key={group.dayKey} className="announcements-feed__day">
              <h3 className="announcements-feed__day-title">{group.dayKey}</h3>
              <div className="announcements-feed__entries">
                {group.items.map((announcement) => {
                  const draft = drafts[announcement.id] || {
                    title: announcement.title,
                    body: announcement.body,
                    category: announcement.category,
                    isPinned: announcement.isPinned,
                    isPublished: announcement.isPublished,
                  };

                  return (
                    <AnnouncementEntry
                      key={announcement.id}
                      announcement={announcement}
                      draft={draft}
                      isManager={isManager}
                      canEdit={canEdit}
                      saving={savingId === announcement.id}
                      editing={editingId === announcement.id}
                      onStartEdit={setEditingId}
                      onCancelEdit={() => setEditingId(null)}
                      onDraftChange={(announcementId, nextDraft) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [announcementId]: nextDraft,
                        }))
                      }
                      onSave={handleManagerSave}
                      engagement={
                        <AnnouncementEngagement
                          announcementId={announcement.id}
                          reactions={reactionsById[announcement.id] || {}}
                          comments={commentsById[announcement.id] || []}
                          commentsOpen={Boolean(commentsOpenById[announcement.id])}
                          commentDraft={commentDraftById[announcement.id] || ''}
                          canEngage={canEngage}
                          isManager={isManager}
                          memberCode={authorCode}
                          busy={engagementBusyId === announcement.id}
                          onToggleReaction={handleToggleReaction}
                          onToggleComments={handleToggleComments}
                          onCommentDraftChange={(id, value) =>
                            setCommentDraftById((prev) => ({ ...prev, [id]: value }))
                          }
                          onSubmitComment={handleSubmitComment}
                          onDeleteComment={handleDeleteComment}
                        />
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
