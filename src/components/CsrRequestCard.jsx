import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';
import {
  CSR_REQUEST_CATEGORY_LIST,
  formatCsrRequestCategoryLabel,
  formatCsrRequestStatusLabel,
} from '../constants/csrRequests.js';
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
  onEdit,
  onDelete,
}) {
  const managerStatusEditable = isManager && !saving;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'improvement' });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const canManageContent = isManager && canEdit && !saving && Boolean(onEdit && onDelete);

  const startEdit = () => {
    setForm({
      title: request.title,
      description: request.description || '',
      category: request.category,
    });
    setConfirmingDelete(false);
    setEditing(true);
  };

  const submitEdit = async () => {
    const result = await onEdit(request.id, form);
    if (result?.ok) setEditing(false);
  };

  const submitDelete = async () => {
    const result = await onDelete(request.id);
    if (!result?.ok) setConfirmingDelete(false);
  };
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
        {editing ? (
          <div className="csr-board-edit">
            <label htmlFor={`csr-edit-title-${request.id}`}>제목</label>
            <input
              id={`csr-edit-title-${request.id}`}
              className="form-input"
              value={form.title}
              maxLength={200}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <label htmlFor={`csr-edit-category-${request.id}`}>유형</label>
            <select
              id={`csr-edit-category-${request.id}`}
              className="form-input"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {CSR_REQUEST_CATEGORY_LIST.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <label htmlFor={`csr-edit-description-${request.id}`}>내용</label>
            <textarea
              id={`csr-edit-description-${request.id}`}
              className="form-input csr-board-textarea"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <div className="csr-board-side__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitEdit}
                disabled={saving || !form.title.trim()}
              >
                수정 저장
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3>{request.title}</h3>
            {request.description && <p className="csr-board-item__desc">{request.description}</p>}
          </>
        )}
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
            {canManageContent && !editing && (
              <div className="csr-board-side__actions csr-board-side__manage">
                <button type="button" className="btn btn-secondary" onClick={startEdit}>
                  수정
                </button>
                {confirmingDelete ? (
                  <>
                    <button type="button" className="btn btn-danger" onClick={submitDelete}>
                      정말 삭제
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setConfirmingDelete(false)}>
                      취소
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirmingDelete(true)}>
                    삭제
                  </button>
                )}
              </div>
            )}
            {canManageContent && confirmingDelete && (
              <p className="csr-board-side__warn" role="alert">
                첨부 파일도 함께 삭제되며 되돌릴 수 없습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

