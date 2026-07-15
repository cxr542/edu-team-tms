import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  placeholder,
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const suggestions = useMemo(
    () => filterJournalTaskTitleSuggestions(titles, value, { limit: 10 }),
    [titles, value]
  );

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
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const showList = open && !readOnly && suggestions.length > 0;

  function pick(title) {
    onChange(title);
    setOpen(false);
    setHighlight(-1);
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
    if (!suggestions.length) return;

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

  return (
    <div className="journal-title-combo" ref={rootRef}>
      <input
        id={inputId}
        className="form-input"
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
      {showList ? (
        <ul id={listId} className="journal-title-combo__list" role="listbox">
          {suggestions.map((title, index) => (
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
          ))}
        </ul>
      ) : null}
    </div>
  );
}
