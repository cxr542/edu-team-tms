import React, { useRef } from 'react';
import { applyWeekColumnEnter } from '../utils/journalWeekColumnText';

/**
 * 주간 요약/차주 예정용 textarea — • / └ 줄에서 Enter 시 └ 자동 삽입
 */
export default function JournalWeekColumnTextarea({
  value,
  onChange,
  readOnly = false,
  className = 'journal-summary-textarea',
  placeholder = '',
}) {
  const ref = useRef(null);

  const handleKeyDown = (e) => {
    if (readOnly || e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;

    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start !== end) return;

    const result = applyWeekColumnEnter(value, start);
    if (!result) return;

    e.preventDefault();
    onChange(result.newValue);
    const pos = result.newCursor;
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.setSelectionRange(pos, pos);
      }
    });
  };

  return (
    <textarea
      ref={ref}
      className={className}
      readOnly={readOnly}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
    />
  );
}
