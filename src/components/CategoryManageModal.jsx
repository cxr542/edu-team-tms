import React, { useState } from 'react';
import { X, Plus, Trash2, RotateCcw } from 'lucide-react';

const EMPTY_FORM = {
  label: '',
  color: '#10b981',
  description: '',
  matchKeywords: '',
};

export default function CategoryManageModal({
  isOpen,
  onClose,
  categories,
  onAdd,
  onUpdate,
  onRemove,
  onReset,
  transactions,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!isOpen) return null;

  const showMsg = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ type: '', text: '' }), 3500);
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setForm({
      label: cat.label,
      color: cat.color,
      description: cat.description,
      matchKeywords: (cat.matchKeywords || []).join(', '),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = editingId ? onUpdate(editingId, form) : onAdd(form);
    if (!result.ok) {
      showMsg(result.error, 'danger');
      return;
    }
    showMsg(editingId ? '수정되었습니다.' : '추가되었습니다.', 'success');
    cancelEdit();
  };

  const handleDelete = (cat) => {
    if (!window.confirm(`「${cat.label}」 사용 유형을 삭제할까요?`)) return;
    const result = onRemove(cat.id);
    if (!result.ok) showMsg(result.error, 'danger');
    else showMsg('삭제되었습니다.', 'success');
  };

  const handleReset = () => {
    if (!window.confirm('기준표를 기본 4종(점심식사 추가분·간식·티타임·기타)으로 되돌릴까요?')) return;
    onReset();
    cancelEdit();
    showMsg('기본 기준표로 복원했습니다.', 'success');
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-content" style={{ maxWidth: '640px', borderColor: 'rgba(14, 165, 233, 0.35)' }}>
        <div className="modal-header">
          <h3>사용 유형 기준표 관리</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          유형을 추가·수정하면 지출 등록·엑셀 불러오기 시 선택 목록과 자동 분류(매칭 키워드)에 반영됩니다.
          브라우저에 저장되며, 다른 PC에서는 별도 설정이 필요합니다.
        </p>

        {message.text && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              backgroundColor: message.type === 'danger' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
              color: message.type === 'danger' ? 'var(--color-danger)' : 'var(--color-success)',
            }}
          >
            {message.text}
          </div>
        )}

        <ul style={{ listStyle: 'none', marginBottom: '1rem', maxHeight: '220px', overflowY: 'auto' }}>
          {categories.map((cat) => (
            <li
              key={cat.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                padding: '0.5rem 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: cat.color,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ color: cat.color, fontSize: '0.85rem' }}>{cat.label}</strong>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{cat.description}</div>
                {cat.matchKeywords?.length > 0 && (
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    키워드: {cat.matchKeywords.join(', ')}
                  </div>
                )}
              </div>
              <button type="button" className="icon-btn" title="수정" onClick={() => startEdit(cat)}>
                수정
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                title="삭제"
                onClick={() => handleDelete(cat)}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{editingId ? '유형 수정' : '새 유형 이름'}</label>
              <input
                className="form-input"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="예: 회식"
                required
              />
            </div>
            <div className="form-group">
              <label>표시 색</label>
              <input
                type="color"
                className="form-input"
                style={{ padding: 4, height: 40 }}
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
            <div className="form-group form-group-full">
              <label>설명</label>
              <input
                className="form-input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="기준표에 보일 설명"
              />
            </div>
            <div className="form-group form-group-full">
              <label>자동 분류 키워드 (쉼표 구분)</label>
              <input
                className="form-input"
                value={form.matchKeywords}
                onChange={(e) => setForm({ ...form, matchKeywords: e.target.value })}
                placeholder="예: 회식, 송년 — 엑셀 비고·내역에 포함되면 이 유형으로 분류"
              />
            </div>
          </div>
          <div className="modal-actions" style={{ borderTop: '1px solid rgba(16, 185, 129, 0.1)', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              <RotateCcw size={14} />
              기본값 복원
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                수정 취소
              </button>
            )}
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#0ea5e9' }}>
              <Plus size={14} />
              {editingId ? '저장' : '유형 추가'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              닫기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
