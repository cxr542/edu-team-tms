import React from 'react';
import { Paperclip } from 'lucide-react';
import { formatCsrRequestCategoryLabel, formatCsrRequestStatusLabel } from '../constants/csrRequests.js';
import { useCsrRequestAttachments } from '../hooks/useCsrRequestAttachments.js';
import { formatCsrAttachmentSize, getCsrAttachmentPublicUrl } from '../utils/csrAttachmentsSupabase.js';

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
  const { attachments, loading: attachmentsLoading } = useCsrRequestAttachments(request.id);

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
        {!attachmentsLoading && attachments.length > 0 && (
          <ul className="csr-board-attachments">
            {attachments.map((attachment) => {
              const url = getCsrAttachmentPublicUrl(attachment.storagePath);
              return (
                <li key={attachment.id}>
                  <a href={url || '#'} target="_blank" rel="noreferrer">
                    <Paperclip size={12} aria-hidden />
                    <span>{attachment.fileName}</span>
                    <small>({formatCsrAttachmentSize(attachment.fileSizeBytes)})</small>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
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
              <div className="csr-board-admin__edit">
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
                <button
                  type="button"
                  className="btn btn-primary csr-board-side__save csr-board-admin__save"
                  onClick={() => onSave(request.id)}
                  disabled={!managerStatusEditable || !canEdit}
                  title="선택한 상태와 관리자 답변을 함께 저장합니다."
                >
                  저장
                </button>
              </div>
            ) : (
              <p className="csr-board-admin__comment">
                {request.adminComment || '아직 답변이 없습니다.'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="csr-board-item__side">
        <div className="csr-board-side__status-row">
          <small>상태</small>
          <strong className={`csr-board-status csr-board-status--compact ${statusClassName(request.status)}`}>
            {formatCsrRequestStatusLabel(request.status)}
          </strong>
        </div>
        {isManager && (
          <div className="csr-board-side__controls">
            <label htmlFor={`csr-status-${request.id}`} className="csr-board-side__label">
              상태 변경
            </label>
            <div className="csr-board-side__actions">
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
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

