import React, { useEffect, useMemo, useState } from 'react';
import { JOURNAL_CATS } from '../constants/journalCategories';
import {
  buildWeekColumnTemplateFromCategories,
  defaultMemberPrefs,
  normalizeMemberPrefs,
  resolveMemberCategories,
} from '../utils/journalMemberPrefs';
import JournalCategoryLegend from './JournalCategoryLegend';
import './JournalMemberPrefsModal.css';

export default function JournalMemberPrefsModal({
  open,
  onClose,
  memberLabel,
  prefs,
  onSave,
}) {
  const [draft, setDraft] = useState(() => normalizeMemberPrefs(prefs));

  useEffect(() => {
    if (open) setDraft(normalizeMemberPrefs(prefs));
  }, [open, prefs]);

  const preview = useMemo(() => resolveMemberCategories(draft), [draft]);

  if (!open) return null;

  const moveCategory = (index, dir) => {
    setDraft((prev) => {
      const order = [...prev.categoryOrder];
      const nextIndex = index + dir;
      if (nextIndex < 0 || nextIndex >= order.length) return prev;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return { ...prev, categoryOrder: order };
    });
  };

  const updateCategory = (key, patch) => {
    setDraft((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [key]: { ...prev.categories[key], ...patch },
      },
    }));
  };

  const handleSave = () => {
    onSave(normalizeMemberPrefs(draft));
    onClose();
  };

  const handleReset = () => {
    if (!window.confirm(`${memberLabel} 범례·기본 양식을 TMS 기본값으로 되돌릴까요?`)) return;
    setDraft(defaultMemberPrefs());
  };

  const syncTemplateFromLegend = () => {
    setDraft((prev) => {
      const { cats, order } = resolveMemberCategories(prev);
      return {
        ...prev,
        weekColumnTemplate: buildWeekColumnTemplateFromCategories(cats, order),
      };
    });
  };

  return (
    <div className="journal-prefs-overlay" role="presentation" onClick={onClose}>
      <div
        className="journal-prefs-modal"
        role="dialog"
        aria-labelledby="journal-prefs-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="journal-prefs-head">
          <div>
            <h2 id="journal-prefs-title">범례 · 기본 양식</h2>
            <p className="journal-prefs-sub">{memberLabel} — 구성원별로 저장됩니다</p>
          </div>
          <button type="button" className="journal-prefs-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <section className="journal-prefs-section">
          <h3>카테고리 범례</h3>
          <p className="journal-prefs-hint">주차별 표 상단 범례·일별 업무 색 점·카테고리 선택에 반영됩니다.</p>
          <JournalCategoryLegend categories={preview.cats} order={preview.order} />
          <ul className="journal-prefs-cat-list">
            {draft.categoryOrder.map((key, index) => {
              const def = JOURNAL_CATS[key];
              const row = draft.categories[key] || {};
              if (!def) return null;
              return (
                <li key={key} className="journal-prefs-cat-row">
                  <div className="journal-prefs-cat-order">
                    <button type="button" disabled={index === 0} onClick={() => moveCategory(index, -1)} aria-label="위로">
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === draft.categoryOrder.length - 1}
                      onClick={() => moveCategory(index, 1)}
                      aria-label="아래로"
                    >
                      ↓
                    </button>
                  </div>
                  <span
                    className="journal-prefs-cat-dot"
                    style={{ backgroundColor: row.color || def.color }}
                    aria-hidden
                  />
                  <label className="journal-prefs-cat-label">
                    <span className="journal-prefs-cat-key">{key}</span>
                    <input
                      type="text"
                      className="form-input"
                      value={row.label ?? def.label}
                      onChange={(e) => updateCategory(key, { label: e.target.value })}
                    />
                  </label>
                  <label className="journal-prefs-cat-color">
                    색
                    <input
                      type="color"
                      value={row.color || def.color}
                      onChange={(e) => updateCategory(key, { color: e.target.value })}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="journal-prefs-section">
          <div className="journal-prefs-section-head">
            <h3>금주(요약) · 차주(예정) 기본 양식</h3>
            <button type="button" className="btn btn-secondary journal-prefs-sync-btn" onClick={syncTemplateFromLegend}>
              범례에서 생성
            </button>
          </div>
          <p className="journal-prefs-hint">
            「기본 양식」 버튼을 누르면 해당 주차 칸에 아래 텍스트가 채워집니다. Enter로 └ 하위 항목을 이어 쓸 수
            있습니다.
          </p>
          <textarea
            className="journal-prefs-template"
            value={draft.weekColumnTemplate}
            onChange={(e) => setDraft((prev) => ({ ...prev, weekColumnTemplate: e.target.value }))}
            rows={10}
            spellCheck={false}
          />
        </section>

        <footer className="journal-prefs-actions">
          <button type="button" className="btn btn-ghost" onClick={handleReset}>
            기본값 복원
          </button>
          <div className="journal-prefs-actions-primary">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              저장
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
