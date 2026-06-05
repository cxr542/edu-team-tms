import React from 'react';
import { JOURNAL_CAT_ORDER, JOURNAL_CATS } from '../constants/journalCategories';
import './JournalCategoryLegend.css';

/** 일지 목록 왼쪽 점 — 카테고리 색상 (한 줄) */
export default function JournalCategoryLegend({ className = '', categories = JOURNAL_CATS, order = JOURNAL_CAT_ORDER }) {
  return (
    <p
      className={`journal-category-legend${className ? ` ${className}` : ''}`}
      role="note"
      aria-label="카테고리 색상"
    >
      {order.map((key, i) => {
        const cat = categories[key];
        if (!cat) return null;
        return (
          <React.Fragment key={key}>
            {i > 0 && (
              <span className="journal-category-legend__sep" aria-hidden>
                ·
              </span>
            )}
            <span className="journal-category-legend__item">
              <span
                className="journal-category-legend__dot"
                style={{ backgroundColor: cat.color }}
                aria-hidden
              />
              {cat.label}
            </span>
          </React.Fragment>
        );
      })}
    </p>
  );
}
