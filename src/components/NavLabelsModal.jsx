import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, X } from 'lucide-react';
import { NAV_LABEL_IDS } from '../constants/navLabels';
import {
  NAV_GROUP_COMMON,
  NAV_GROUP_EXPERIMENTAL,
  NAV_GROUP_LEADER_WORK,
  NAV_GROUP_MEMBER_WORK,
} from '../constants/teamAccess';

/** 팀 공유 저장 상태를 사람이 읽는 문장으로 */
export function describeSharedStatus(shared) {
  const status = shared?.status || 'idle';
  const stamp = shared?.at ? ` (${new Date(shared.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})` : '';
  if (status === 'idle' || status === 'loading') return { tone: 'muted', text: '팀 공유 설정을 불러오는 중…' };
  if (status === 'saving') return { tone: 'muted', text: '팀 공유 저장 중…' };
  if (status === 'saved') return { tone: 'ok', text: `팀 공유로 저장됐어요${stamp}. 다른 관리자 브라우저에도 같게 보여요.` };
  if (status === 'ready') return { tone: 'ok', text: `팀 공유 설정을 불러왔어요${stamp}. 바꾸면 모든 관리자 브라우저에 적용돼요.` };
  if (status === 'empty') return { tone: 'muted', text: '아직 공유된 설정이 없어요. 바꾸면 팀 공유로 저장돼요.' };
  if (status === 'not-ready') return { tone: 'warn', text: '팀 공유 저장소가 아직 준비되지 않아 이 브라우저에만 저장돼요. (관리자에게 문의)' };
  return { tone: 'warn', text: `팀 공유 저장에 실패해 이 브라우저에만 저장됐어요${shared?.message ? ` (${shared.message})` : ''}.` };
}

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
  onMoveEdge,
  shared,
}) {
  const [draft, setDraft] = useState(labels);

  useEffect(() => {
    if (isOpen) setDraft(labels);
  }, [isOpen, labels]);

  if (!isOpen) return null;

  // 한 칸 옮기면 그 항목이 위·아래로 자리를 바꾸므로, 같은 항목의 버튼에 포커스를 돌려 연속으로 누를 수 있게 한다
  const keepFocus = (buttonId, fallbackId) => {
    requestAnimationFrame(() => {
      const target = document.getElementById(buttonId);
      const el = target && !target.disabled ? target : document.getElementById(fallbackId);
      el?.focus();
      el?.scrollIntoView?.({ block: 'nearest' });
    });
  };
  const sharedStatus = describeSharedStatus(shared);

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
              onClick={() => {
                onMoveEdge(group, id, 'top');
                keepFocus(`nav-label-${id}`, `nav-label-${id}`);
              }}
              disabled={index === 0}
              aria-label={`${draft[id] || defaults[id]} 맨 위로`}
              title="맨 위로"
            >
              <ChevronsUp size={16} aria-hidden />
            </button>
            <button
              type="button"
              id={`nav-up-${id}`}
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.45rem' }}
              onClick={() => {
                onMove(group, id, -1);
                keepFocus(`nav-up-${id}`, `nav-label-${id}`);
              }}
              disabled={index === 0}
              aria-label={`${draft[id] || defaults[id]} 위로`}
              title="한 칸 위로"
            >
              <ChevronUp size={16} aria-hidden />
            </button>
            <button
              type="button"
              id={`nav-down-${id}`}
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.45rem' }}
              onClick={() => {
                onMove(group, id, 1);
                keepFocus(`nav-down-${id}`, `nav-label-${id}`);
              }}
              disabled={index === count - 1}
              aria-label={`${draft[id] || defaults[id]} 아래로`}
              title="한 칸 아래로"
            >
              <ChevronDown size={16} aria-hidden />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.45rem' }}
              onClick={() => {
                onMoveEdge(group, id, 'bottom');
                keepFocus(`nav-label-${id}`, `nav-label-${id}`);
              }}
              disabled={index === count - 1}
              aria-label={`${draft[id] || defaults[id]} 맨 아래로`}
              title="맨 아래로"
            >
              <ChevronsDown size={16} aria-hidden />
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
              왼쪽 메뉴에 보이는 이름을 바꾸고, 각 묶음 안에서 버튼으로 순서를 바꿀 수 있습니다
              (⇈ 맨 위로 · ↑ 한 칸 위로 · ↓ 한 칸 아래로 · ⇊ 맨 아래로). 순서는 누르는 즉시 적용되고,
              이름·순서는 팀 공유 저장소에 저장되어 다른 관리자 브라우저에서도 같게 보입니다.
              예: 「월별 지출 장부」→「팀 빌딩비 관리」
            </p>
            <p
              role="status"
              style={{
                fontSize: '0.8rem',
                lineHeight: 1.5,
                margin: 0,
                color:
                  sharedStatus.tone === 'warn'
                    ? 'var(--color-danger)'
                    : sharedStatus.tone === 'ok'
                      ? 'var(--color-success)'
                      : 'var(--text-muted)',
              }}
            >
              {sharedStatus.text}
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
