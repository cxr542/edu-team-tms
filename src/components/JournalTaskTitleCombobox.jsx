import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { filterJournalTaskTitleSuggestions } from '../utils/journalTaskTitleSuggestions.js';
import './JournalTaskTitleCombobox.css';

/**
 * Task title input with suggestions from previously used journal titles.
 * @param {{
 *   value: string,
 *   onChange: (next: string) => void,
 *   titles: string[],
 *   readOnly?: boolean,
 *   id?: string,
 *   placeholder?: string,
 * }} props
 */
export default function JournalTaskTitleCombobox({
  value,
  onChange,
  titles,
  readOnly = false,
  id,
  placeholder = '입력하거나 ▾ 로 이전 업무명 선택',
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [menuBox, setMenuBox] = useState(
    /** @type {{ top: number, left: number, width: number } | null} */ (null)
  );

  const titleCount = Array.isArray(titles) ? titles.length : 0;
  const suggestions = useMemo(
    () => filterJournalTaskTitleSuggestions(titles, value, { limit: 12 }),
    [titles, value]
  );

  const showList = open && !readOnly && (suggestions.length > 0 || titleCount === 0);

  function updateMenuBox() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuBox({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }

  useLayoutEffect(() => {
    if (!showList) {
      setMenuBox(null);
      return undefined;
    }
    updateMenuBox();
    const onReposition = () => updateMenuBox();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [showList, suggestions.length, value]);

  useEffect(() => {
    setHighlight((prev) => {
      if (!suggestions.length) return -1;
      if (prev < 0) return prev;
      return Math.min(prev, suggestions.length - 1);
    });
  }, [suggestions]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`#${CSS.escape(listId)}`)) return;
      setOpen(false);
      setHighlight(-1);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, listId]);

  function pick(title) {
    onChange(title);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(event) {
    if (readOnly) return;
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setHighlight(-1);
      }
      return;
    }
    if (!suggestions.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (prev < 0 ? 0 : Math.min(prev + 1, suggestions.length - 1)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlight((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      return;
    }
    if (event.key === 'Enter' && open && highlight >= 0 && suggestions[highlight]) {
      event.preventDefault();
      pick(suggestions[highlight]);
    }
  }

  const list =
    showList && menuBox && typeof document !== 'undefined'
      ? createPortal(
          <ul
            id={listId}
            className="journal-title-combo__list journal-title-combo__list--portal"
            role="listbox"
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
          >
            {suggestions.length === 0 ? (
              <li className="journal-title-combo__empty" role="presentation">
                이전에 저장한 업무명이 없습니다. 직접 입력하세요.
              </li>
            ) : (
              suggestions.map((title, index) => (
                <li
                  key={title}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={index === highlight}
                  className={`journal-title-combo__option${
                    index === highlight ? ' is-active' : ''
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(title);
                  }}
                >
                  {title}
                </li>
              ))
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className="journal-title-combo" ref={rootRef}>
      <div className="journal-title-combo__field">
        <input
          ref={inputRef}
          id={inputId}
          className="form-input journal-title-combo__input"
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
          }
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => {
            if (!readOnly) setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {!readOnly ? (
          <button
            type="button"
            className="journal-title-combo__toggle"
            tabIndex={-1}
            aria-label="이전 업무명 목록"
            aria-expanded={showList}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        ) : null}
      </div>
      {titleCount > 0 ? (
        <p className="journal-title-combo__hint">이전 업무명 {titleCount}개 · 입력하거나 ▾ 클릭</p>
      ) : (
        <p className="journal-title-combo__hint">저장된 업무명이 생기면 여기에 제안됩니다</p>
      )}
      {list}
    </div>
  );
}
