import { dateKey } from './journalMm.js';

/**
 * 일일 업무일지 — 오늘 셀로 스크롤
 * (document/body 세로 + .journal-week-table-wrap 가로, sticky 헤더 보정)
 */

/** 주말이면 표에 있는 가장 가까운 금요일로 보정 (월~금만 표시) */
export function resolveJournalScrollDayKey(dayKey) {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dayKey;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  if (dow === 6) dt.setDate(dt.getDate() - 1);
  else if (dow === 0) dt.setDate(dt.getDate() - 2);
  return dateKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/** @param {Array<{ key: string, days: Date[] }>} weeks */
export function findWeekKeyForDayKey(weeks, dayKey) {
  if (!dayKey || !Array.isArray(weeks)) return null;
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const week = weeks.find((w) =>
    w.days.some(
      (dt) => dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    )
  );
  return week?.key ?? null;
}

/** 셀 기준 실제 세로 스크롤 컨테이너 (journal-main은 overflow:visible → body) */
export function resolveVerticalScrollElement(fromEl) {
  if (typeof window === 'undefined' || !fromEl) {
    return null;
  }
  let node = fromEl.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function scrollHorizontallyToCell(cell) {
  const tableWrap = cell.closest('.journal-week-table-wrap');
  if (!tableWrap) return;
  const wrapRect = tableWrap.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const nextLeft =
    tableWrap.scrollLeft + (cellRect.left - wrapRect.left) - wrapRect.width / 2 + cellRect.width / 2;
  tableWrap.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' });
}

function scrollVerticallyToCell(cell, journalMainEl) {
  const scrollEl = resolveVerticalScrollElement(cell);
  const sticky = (journalMainEl || document.querySelector('.journal-main'))?.querySelector(
    '.journal-sticky-top'
  );
  const stickyH = sticky?.getBoundingClientRect().height ?? 0;
  const offset = stickyH + 16;
  const cellRect = cell.getBoundingClientRect();

  if (!scrollEl || scrollEl === document.documentElement || scrollEl === document.body) {
    const top = window.scrollY + cellRect.top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    return;
  }

  const containerRect = scrollEl.getBoundingClientRect();
  const top = scrollEl.scrollTop + (cellRect.top - containerRect.top) - offset;
  scrollEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

export function scrollJournalDayIntoView(dayKey, journalMainEl) {
  if (!dayKey || typeof document === 'undefined') return false;

  const cell = document.querySelector(`td.journal-day-cell[data-day="${dayKey}"]`);
  if (!cell) return false;

  scrollHorizontallyToCell(cell);
  scrollVerticallyToCell(cell, journalMainEl);
  return true;
}

/** DOM 반영 후 재시도 (월 전환·주차 펼치기 직후). 취소 함수 반환 */
export function scheduleScrollJournalDay(dayKey, journalMainEl, { maxAttempts = 72, onSuccess, onFailure } = {}) {
  let cancelled = false;
  let attempts = 0;

  const tick = () => {
    if (cancelled) return;
    if (scrollJournalDayIntoView(dayKey, journalMainEl)) {
      onSuccess?.();
      return;
    }
    attempts += 1;
    if (attempts < maxAttempts) {
      requestAnimationFrame(tick);
    } else {
      onFailure?.();
    }
  };

  requestAnimationFrame(tick);
  return () => {
    cancelled = true;
  };
}
