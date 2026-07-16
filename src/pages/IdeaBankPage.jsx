import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lightbulb, Plus, RotateCcw } from 'lucide-react';
import { CSR_REQUEST_CATEGORY_LIST } from '../constants/csrRequests.js';
import CsrRequestCard from '../components/CsrRequestCard.jsx';
import { useCsrRequests } from '../hooks/useCsrRequests.js';
import { isEditorMode } from '../utils/appMode.js';
import { resolveCsrRequesterIdentity } from '../utils/csrRequesterIdentity.js';
import './IdeaBankPage.css';

export default function IdeaBankPage({
  readOnly = false,
  teamAccess = null,
  requesterCode: requesterCodeProp = null,
  requesterName: requesterNameProp = null,
}) {
  const isManager = Boolean(teamAccess?.isLeader && !teamAccess?.isMemberScope);
  const requesterIdentity =
    requesterCodeProp && requesterNameProp
      ? { requesterCode: requesterCodeProp, requesterName: requesterNameProp }
      : resolveCsrRequesterIdentity(teamAccess);
  const requesterCode = requesterIdentity.requesterCode;
  const requesterName = requesterIdentity.requesterName;
  const canEdit = isEditorMode() && !readOnly;
  const canSubmit = canEdit;

  const {
    requests,
    loading,
    savingId,
    error,
    sourceStatus,
    summary,
    refresh,
    createRequest,
    updateRequest,
  } = useCsrRequests({ requesterCode, requesterName, canManage: isManager });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('improvement');
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts((prev) => {
      const next = {};
      requests.forEach((request) => {
        next[request.id] = prev[request.id] || {
          status: request.status,
          adminComment: request.adminComment || '',
        };
      });
      return next;
    });
  }, [requests]);

  const visibleRequests = requests;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setMessage('조회 모드에서는 등록할 수 없습니다.');
      return;
    }
    const result = await createRequest({
      title,
      description,
      category,
      requester: requesterName,
      requesterCode,
    });
    if (!result.ok) {
      setMessage(
        result.reason === 'name-required'
          ? '제목을 입력해 주세요.'
          : result.message || 'CSR 요청 등록에 실패했습니다.'
      );
      return;
    }
    setTitle('');
    setDescription('');
    setCategory('improvement');
    setMessage('요청이 접수되었습니다.');
  };

  const handleManagerSave = async (requestId) => {
    const draft = drafts[requestId];
    const request = requests.find((item) => item.id === requestId);
    if (!draft || !request) return;
    const result = await updateRequest(requestId, {
      status: draft.status,
      adminComment: draft.adminComment,
    });
    if (!result.ok) {
      setMessage(result.message || '상태를 저장하지 못했습니다.');
      return;
    }
    setMessage('요청 상태가 저장되었습니다.');
  };

  const summaryCards = [
    ['전체 요청', summary.total],
    ['접수', summary.received],
    ['진행 중', summary.inProgress],
    ['완료', summary.done],
  ];

  return (
    <main className="idea-bank-page csr-board-page">
      <header className="idea-bank-header csr-board-header">
        <div className="csr-board-header__title">
          <Lightbulb size={18} aria-hidden />
          <div>
            <h2>이것도 CSR 게시판</h2>
            <p>버그, 개선 요청, 추가 개발, 문의를 등록하고 처리 상태를 관리합니다.</p>
          </div>
        </div>
        <div className="csr-board-header__meta">
          <strong>요청자 {requesterName}</strong>
          <span>{isManager ? '관리자 모드' : '구성원 모드'}</span>
        </div>
      </header>

      <section className="idea-bank-panel csr-board-summary">
        <div className="csr-board-summary__grid">
          {summaryCards.map(([label, value]) => (
            <article key={label} className="csr-board-summary__card">
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <div className="csr-board-summary__sub">
          <span>보류 {summary.hold}</span>
          <span>불가 {summary.rejected}</span>
          <span>{sourceStatus === 'disabled' ? 'Supabase 미설정' : sourceStatus === 'error' ? 'Supabase 오류' : 'Supabase 연결 확인'}</span>
        </div>
      </section>

      <section className="idea-bank-panel csr-board-panel">
        {!canSubmit && (
          <p className="idea-bank-readonly csr-board-note">
            조회 모드에서는 등록할 수 없습니다. 요청 등록은 편집 모드에서만 가능합니다.
          </p>
        )}
        {error && (
          <p className="csr-board-alert csr-board-alert--warning">
            <AlertTriangle size={14} aria-hidden />
            {error}
          </p>
        )}
        {sourceStatus === 'disabled' && import.meta.env.DEV && requests.length > 0 && (
          <p className="idea-bank-message csr-board-message">
            <CheckCircle2 size={14} aria-hidden />
            로컬 UI 미리보기 — 저장·등록은 Supabase `.env` 설정 후 동작합니다.
          </p>
        )}
        {message && (
          <p className="idea-bank-message csr-board-message">
            <CheckCircle2 size={14} aria-hidden />
            {message}
          </p>
        )}
        <form className="idea-bank-form csr-board-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="csr-title">제목</label>
            <input
              id="csr-title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: KPI 승인 화면 저장 지연"
              maxLength={120}
              disabled={!canSubmit}
            />
          </div>
          <div className="form-group">
            <label htmlFor="csr-category">유형</label>
            <select
              id="csr-category"
              className="form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!canSubmit}
            >
              {CSR_REQUEST_CATEGORY_LIST.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group csr-board-form__wide">
            <label htmlFor="csr-description">내용</label>
            <textarea
              id="csr-description"
              className="form-input csr-board-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="문제 상황, 기대 동작, 화면 경로를 적어 주세요."
              rows={4}
              maxLength={1000}
              disabled={!canSubmit}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || savingId !== null}>
            <Plus size={14} />
            요청 등록
          </button>
          <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}>
            <RotateCcw size={14} />
            새로고침
          </button>
        </form>
      </section>

      <section className="idea-bank-list csr-board-list">
        {loading ? (
          <div className="idea-bank-empty">요청을 불러오는 중입니다.</div>
        ) : visibleRequests.length === 0 ? (
          <div className="idea-bank-empty">아직 등록된 CSR 요청이 없습니다.</div>
        ) : (
          visibleRequests.map((item) => {
            const draft = drafts[item.id] || {
              status: item.status,
              adminComment: item.adminComment || '',
            };
            return (
              <CsrRequestCard
                key={item.id}
                request={item}
                draft={draft}
                isManager={isManager}
                canEdit={canSubmit}
                saving={savingId === item.id}
                onDraftChange={(requestId, nextDraft) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [requestId]: nextDraft,
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
