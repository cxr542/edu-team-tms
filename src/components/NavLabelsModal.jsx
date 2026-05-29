import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { NAV_LABEL_IDS } from '../constants/navLabels';

export default function NavLabelsModal({ isOpen, onClose, labels, defaults, onSave, onReset }) {
  const [draft, setDraft] = useState(labels);

  useEffect(() => {
    if (isOpen) setDraft(labels);
  }, [isOpen, labels]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    NAV_LABEL_IDS.forEach((id) => {
      const v = String(draft[id] || '').trim();
      if (v) onSave(id, v);
    });
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="nav-labels-title"
      >
        <div className="modal-header-row">
          <h3 id="nav-labels-title">사이드바 메뉴 이름</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body-stack">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              왼쪽 메뉴에 보이는 이름을 바꿀 수 있습니다. 예: 「월별 지출 장부」→「팀 빌딩비 관리」
            </p>
            {NAV_LABEL_IDS.map((id) => (
              <div className="form-group" key={id}>
                <label>{defaults[id]} (기본)</label>
                <input
                  type="text"
                  className="form-input"
                  value={draft[id] || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [id]: e.target.value }))}
                  maxLength={40}
                />
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onReset}>
              기본값 복원
            </button>
            <button type="submit" className="btn btn-primary">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
