import React from 'react';
import { formatCsrRequestCategoryLabel, formatCsrRequestStatusLabel } from '../constants/csrRequests.js';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return value;
  }
}

function statusClassName(status) {
  if (status === 'received') return 'is-received';
  if (status === 'inProgress') return 'is-progress';
  if (status === 'done') return 'is-done';
  if (status === 'hold') return 'is-hold';
  if (status === 'rejected') return 'is-rejected';
  return 'is-received';
}

export default function CsrRequestCard({
  request,
  draft,
  isManager = false,
  canEdit = false,
  saving = false,
  onDraftChange,
  onSave,
}) {
  const managerStatusEditable = isManager && !saving;

  return (
    <article className="idea-bank-item csr-board-item">
      <div className="csr-board-item__main">
        <div className="csr-board-item__topline">
          <span className={`csr-board-badge csr-board-badge--${request.category}`}>
            [{formatCsrRequestCategoryLabel(request.category)}]
          </span>
          <span className={`csr-board-status ${statusClassName(request.status)}`}>
            {formatCsrRequestStatusLabel(request.status)}
          </span>
        </div>
        <h3>{request.title}</h3>
        {request.description && <p className="csr-board-item__desc">{request.description}</p>}
        <div className="csr-board-item__meta">
          <span>요청자: {request.requester}</span>
          <span>등록: {formatDate(request.createdAt)}</span>
          <span>수정: {formatDate(request.updatedAt)}</span>
        </div>
        {request.completedAt && (
          <div className="csr-board-item__meta">
            <span>완료일: {formatDate(request.completedAt)}</span>
          </div>
        )}
        {(request.adminComment || managerStatusEditable) && (
          <div className="csr-board-admin">
            <label htmlFor={`csr-comment-${request.id}`}>관리자 답변</label>
            {managerStatusEditable ? (
              <textarea
                id={`csr-comment-${request.id}`}
                className="form-input csr-board-textarea"
                rows={3}
                value={draft.adminComment}
                onChange={(e) =>
                  onDraftChange(request.id, {
                    ...draft,
                    adminComment: e.target.value,
                  })
                }
                placeholder="처리 계획 또는 완료 사유를 적어 주세요."
                disabled={!canEdit}
              />
            ) : (
              <p className="csr-board-admin__comment">
                {request.adminComment || '아직 답변이 없습니다.'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="csr-board-item__side">
        <small>상태</small>
        <strong className={`csr-board-status csr-board-status--compact ${statusClassName(request.status)}`}>
          {formatCsrRequestStatusLabel(request.status)}
        </strong>
        {isManager && (
          <>
            <label htmlFor={`csr-status-${request.id}`} className="csr-board-side__label">
              상태 변경
            </label>
            <select
              id={`csr-status-${request.id}`}
              className="form-input csr-board-side__select"
              value={draft.status}
              onChange={(e) =>
                onDraftChange(request.id, {
                  ...draft,
                  status: e.target.value,
                })
              }
              disabled={!managerStatusEditable || !canEdit}
            >
              <option value="received">접수</option>
              <option value="inProgress">진행 중</option>
              <option value="done">완료</option>
              <option value="hold">보류</option>
              <option value="rejected">불가</option>
            </select>
            <button
              type="button"
              className="btn btn-primary csr-board-side__save"
              onClick={() => onSave(request.id)}
              disabled={!managerStatusEditable || !canEdit}
            >
              저장
            </button>
          </>
        )}
      </div>
    </article>
  );
}

