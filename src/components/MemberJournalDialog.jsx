import React, { useEffect } from 'react';

export default function MemberJournalDialog({ open, onClose, title, titleId, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="journal-prefs-overlay" role="presentation" onClick={onClose}>
      <div
        className={`journal-prefs-modal${wide ? ' journal-prefs-modal--wide' : ''}`}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="journal-prefs-head">
          <div>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="journal-prefs-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>
        <div className="journal-member-dialog__body">{children}</div>
      </div>
    </div>
  );
}
