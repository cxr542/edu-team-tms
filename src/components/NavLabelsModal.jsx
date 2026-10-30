import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { NAV_LABEL_IDS } from '../constants/navLabels';
import {
  NAV_GROUP_COMMON,
  NAV_GROUP_EXPERIMENTAL,
  NAV_GROUP_LEADER_WORK,
  NAV_GROUP_MEMBER_WORK,
} from '../constants/teamAccess';

/** 순서를 바꿀 수 있는 사이드바 그룹 (관리자 사이드바 기준) */
const ORDER_GROUPS = [
  { id: 'common', title: NAV_GROUP_COMMON },
  { id: 'memberWork', title: NAV_GROUP_MEMBER_WORK },
  { id: 'experimental', title: NAV_GROUP_EXPERIMENTAL },
  { id: 'leader', title: NAV_GROUP_LEADER_WORK },
];

export default function NavLabelsModal({
  isOpen,
  onClose,
  labels,
  defaults,
  onSave,
  onReset,
  orderOf,
  onMove,
}) {
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

  const groups = orderOf ? ORDER_GROUPS.map((g) => ({ ...g, ids: orderOf(g.id) })) : [];
  const grouped = new Set(groups.flatMap((g) => g.ids));
  const others = NAV_LABEL_IDS.filter((id) => !grouped.has(id));

  const renderRow = (id, group = null, index = 0, count = 1) => (
    <div className="form-group" key={id}>
      <label htmlFor={`nav-label-${id}`}>{defaults[id]} (기본)</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          id={`nav-label-${id}`}
          type="text"
          className="form-input"
          value={draft[id] || ''}
          onChange={(e) => setDraft((prev) => ({ ...prev, [id]: e.target.value }))}
          maxLength={40}
          style={{ flex: 1 }}
        />
        {group && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.45rem' }}
              onClick={() => onMove(group, id, -1)}
              disabled={index === 0}
              aria-label={`${draft[id] || defaults[id]} 위로`}
            >
              <ChevronUp size={16} aria-hidden />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.45rem' }}
              onClick={() => onMove(group, id, 1)}
              disabled={index === count - 1}
              aria-label={`${draft[id] || defaults[id]} 아래로`}
            >
              <ChevronDown size={16} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay active" onClick={onClose} role="presentation">
      <div
        className="modal-content"
        style={{ maxWidth: 460, maxHeight: '88vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="nav-labels-title"
      >
        <div className="modal-header-row">
          <h3 id="nav-labels-title">사이드바 메뉴 이름·순서</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body-stack">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              왼쪽 메뉴에 보이는 이름을 바꾸고, 각 묶음 안에서 위·아래 버튼으로 순서를 바꿀 수 있습니다.
              순서는 누르는 즉시 적용되며, 이 브라우저에만 저장됩니다. 예: 「월별 지출 장부」→「팀 빌딩비 관리」
            </p>
            {groups.map((g) => (
              <fieldset key={g.id} style={{ border: 0, margin: 0, padding: 0 }}>
                <legend style={{ fontSize: '0.8rem', fontWeight: 600, margin: '0.4rem 0' }}>{g.title}</legend>
                {g.ids.map((id, i) => renderRow(id, g.id, i, g.ids.length))}
              </fieldset>
            ))}
            {others.length > 0 && (
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend style={{ fontSize: '0.8rem', fontWeight: 600, margin: '0.4rem 0' }}>도구·참고</legend>
                {others.map((id) => renderRow(id))}
              </fieldset>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onReset}>
              이름·순서 기본값 복원
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
