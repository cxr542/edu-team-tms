import React, { useEffect } from 'react';

/**
 * 월간 일지 AI 요약 미리보기 모달 — 편집 후 「등록」하면 자체평가 근거에 추가된다.
 */
export default function CompetencyAiSummaryModal({
  open,
  monthLabel,
  loading,
  error,
  text,
  onChangeText,
  onRegister,
  onRegenerate,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const canRegister = !loading && !error && text.trim().length > 0;

  return (
    <>
      <div className="competency-ai-overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="competency-ai-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${monthLabel} 월간 일지 AI 요약`}
      >
        <h3 className="competency-ai-title">🤖 {monthLabel} 월간 일지 AI 요약</h3>
        <div className="competency-ai-body">
          <p className="team-kpi-hint">
            이 달의 일일 업무일지를 바탕으로 AI가 작성한 요약입니다. 필요하면 고친 뒤 「등록」을 누르면
            자체평가 근거 뒤에 추가됩니다.
          </p>
          {loading ? (
            <p className="competency-ai-status" role="status">
              AI 요약을 생성하는 중입니다. (보통 10~30초, 최대 1분 소요)
            </p>
          ) : error ? (
            <p className="competency-ai-status competency-ai-status--error" role="alert">
              {error}
            </p>
          ) : (
            <textarea
              className="form-input competency-ai-text"
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              aria-label="AI 요약 내용"
            />
          )}
        </div>
        <div className="modal-actions competency-ai-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRegenerate} disabled={loading}>
            다시 생성
          </button>
          <button type="button" className="btn btn-primary" onClick={onRegister} disabled={!canRegister}>
            등록
          </button>
        </div>
      </div>
    </>
  );
}
