import React, { useState } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { parseCardNotification } from '../utils/cardNotificationParser';

export default function CardPasteModal({
  isOpen,
  onClose,
  categories,
  defaultCategory,
  onApply,
}) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);
  const [category, setCategory] = useState(defaultCategory || '기타');

  if (!isOpen) return null;

  const runParse = () => {
    const result = parseCardNotification(text);
    if (result.ok) {
      setPreview(result.draft);
      setErrors([]);
      setCategory(result.draft.category || defaultCategory || '기타');
    } else {
      setPreview(result.partial ? { ...result.partial, paymentMethod: '법인카드' } : null);
      setErrors(result.errors || ['파싱에 실패했습니다.']);
    }
  };

  const handleApply = () => {
    if (!preview?.amount) {
      runParse();
      return;
    }
    onApply({
      ...preview,
      category,
    });
    setText('');
    setPreview(null);
    setErrors([]);
    onClose();
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-content" style={{ maxWidth: '560px', borderColor: 'rgba(245, 158, 11, 0.35)' }}>
        <div className="modal-header">
          <h3>
            <MessageSquare size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            법인카드 알림 붙여넣기
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            marginBottom: '1rem',
            lineHeight: 1.55,
            padding: '0.65rem',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
          }}
        >
          <strong style={{ color: 'var(--accent)' }}>카카오톡 완전 자동 연동은 불가</strong>합니다. 카카오는
          메시지를 외부 앱이 읽도록 허용하지 않으며, 웹 브라우저 TMS만으로는 알림을 가져올 수 없습니다.
          <br />
          <br />
          대신 카카오톡에서 법인카드 승인 알림을 <strong>복사</strong>해 아래에 붙여넣으면 금액·가맹점·날짜를
          추출해 장부에 넣을 수 있습니다. (카드사·문구마다 결과가 다를 수 있습니다)
        </div>

        <textarea
          className="form-input"
          rows={8}
          placeholder={`카카오톡 알림 예시:\n[신한카드] 법인\n승인\n일시 05/29 12:30\n금액 36,000원\n가맹점 OO카페`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', marginBottom: '0.5rem' }}
        />

        <button type="button" className="btn btn-secondary" style={{ marginBottom: '0.75rem' }} onClick={runParse}>
          문구 분석
        </button>

        {errors.length > 0 && (
          <ul style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginBottom: '0.75rem', paddingLeft: '1.2rem' }}>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}

        {preview && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              marginBottom: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <div>날짜: {preview.date || '—'}</div>
            <div>금액: {preview.amount ? `${Number(preview.amount).toLocaleString()}원` : '—'}</div>
            <div>내역: {preview.description || '—'}</div>
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>사용 유형</label>
              <select
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ marginTop: 4 }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ borderTop: '1px solid rgba(16, 185, 129, 0.1)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ backgroundColor: '#f59e0b' }}
            onClick={handleApply}
            disabled={!preview?.amount}
          >
            장부에 반영
          </button>
        </div>
      </div>
    </div>
  );
}
