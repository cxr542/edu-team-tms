/**
 * 일일 업무일지 — 오늘 셀로 스크롤
 * (.journal-main 세로 + .journal-week-table-wrap 가로, sticky 헤더 보정)
 */
export function scrollJournalDayIntoView(dayKey, journalMainEl) {
  if (!dayKey) return false;

  const cell = document.querySelector(`td.journal-day-cell[data-day="${dayKey}"]`);
  if (!cell) return false;

  const main = journalMainEl || document.querySelector('.journal-main');
  const tableWrap = cell.closest('.journal-week-table-wrap');

  if (tableWrap) {
    const wrapRect = tableWrap.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const nextLeft =
      tableWrap.scrollLeft + (cellRect.left - wrapRect.left) - wrapRect.width / 2 + cellRect.width / 2;
    tableWrap.scrollTo({ left: Math.max(0, nextLeft), behavior: 'smooth' });
  }

  if (main) {
    const sticky = main.querySelector('.journal-sticky-top');
    const stickyH = sticky?.getBoundingClientRect().height ?? 0;
    const mainRect = main.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const top = main.scrollTop + (cellRect.top - mainRect.top) - stickyH - 20;
    main.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  return true;
}

/** DOM 반영 후 재시도 (월 전환 직후). 취소 함수 반환 */
export function scheduleScrollJournalDay(dayKey, journalMainEl, { maxAttempts = 24, onSuccess } = {}) {
  let cancelled = false;
  let attempts = 0;

  const tick = () => {
    if (cancelled) return;
    if (scrollJournalDayIntoView(dayKey, journalMainEl)) {
      onSuccess?.();
      return;
    }
    attempts += 1;
    if (attempts < maxAttempts) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
  return () => {
    cancelled = true;
  };
}
