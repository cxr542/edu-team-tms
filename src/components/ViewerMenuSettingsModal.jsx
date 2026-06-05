import React, { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { VIEWER_MENU_OPTIONS } from '../constants/viewerMenu';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   visibility: Record<string, boolean>,
 *   navLabels: Record<string, string>,
 *   onApply: (next: Record<string, boolean>) => void,
 *   onReset: () => void,
 * }} props
 */
export default function ViewerMenuSettingsModal({
  isOpen,
  onClose,
  visibility,
  navLabels,
  onApply,
  onReset,
}) {
  const [draft, setDraft] = useState(visibility);

  useEffect(() => {
    if (isOpen) setDraft(visibility);
  }, [isOpen, visibility]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply({ ...draft, ledger: true });
    onClose();
  };

  return (
    <div className="modal-overlay active" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="viewer-menu-title"
      >
        <div className="modal-header-row">
          <h3 id="viewer-menu-title">
            <Eye size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden />
            조회 화면 메뉴
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body-stack">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <strong>https://okestro-edu-team-tms.vercel.app/</strong> (조회 URL)에 보일 메뉴를
              고릅니다. 작성(<code>?mode=edit</code>) 화면 메뉴는 그대로입니다.
            </p>
            <ul className="viewer-menu-settings-list">
              {VIEWER_MENU_OPTIONS.map((opt) => {
                const label = navLabels[opt.id] || opt.id;
                const checked = opt.required ? true : Boolean(draft[opt.id]);
                return (
                  <li key={opt.id} className="viewer-menu-settings-item">
                    <label className={`viewer-menu-settings-label${opt.required ? ' is-required' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={opt.required}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [opt.id]: e.target.checked }))
                        }
                      />
                      <span className="viewer-menu-settings-label__text">
                        <strong>{label}</strong>
                        <span className="viewer-menu-settings-label__desc">{opt.description}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                onReset();
                onClose();
              }}
            >
              기본값 (장부만)
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
