/** 휴일 M/M 메모 항목 — 실작업·KPI2 집계에서 제외 */
export const LEAVE_MEMO_TASK_RE = /반차|공휴일|연차|외근|출장/;
const FULL_LEAVE_MM = 0.8125;
const HALF_LEAVE_MM = 0.40625;

export const LEAVE_PRESET_BUTTONS = [
  { id: 'holiday', label: '공휴', group: 'full' },
  { id: 'annual', label: '연차 1일', group: 'full' },
  { id: 'field', label: '외근 1일', group: 'full' },
  { id: 'trip', label: '출장 1일', group: 'full' },
  { id: 'half-am', label: '오전반차', group: 'half' },
  { id: 'half-pm', label: '오후반차', group: 'half' },
  { id: 'quarter', label: '반반차', group: 'half' },
  { id: 'clear', label: '해제', group: 'clear' },
];

function appendMemoTask(tasks, title, note) {
  const next = [...tasks];
  if (next.some((t) => t.title === title)) return next;
  next.push({
    id: `t-leave-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cat: 'other',
    title,
    plan: 0,
    actual: 0,
    done: true,
    note,
  });
  return next;
}

/** null이면 변경 없음 */
export function applyLeavePresetToDay(day, preset, { publicHoliday = false } = {}) {
  const withPublicHolidayOverride = (next, enabled) => {
    const withoutOverride = { ...next };
    delete withoutOverride.publicHolidayOverride;
    if (!publicHoliday || !enabled) return withoutOverride;
    return { ...withoutOverride, publicHolidayOverride: true };
  };

  if (preset === 'holiday') {
    return withPublicHolidayOverride(
      {
        ...day,
        holiday: true,
        mm: { work: 0, improve: 0, leave: FULL_LEAVE_MM },
        tasks: appendMemoTask(day.tasks, '공휴일', '휴일 M/M 0.8125'),
      },
      false
    );
  }
  if (preset === 'annual') {
    return withPublicHolidayOverride(
      {
        ...day,
        holiday: true,
        mm: { work: 0, improve: 0, leave: FULL_LEAVE_MM },
        tasks: appendMemoTask(day.tasks, '연차', '휴일 M/M 0.8125'),
      },
      false
    );
  }
  if (preset === 'field') {
    return withPublicHolidayOverride(
      {
        ...day,
        holiday: true,
        mm: { work: 0, improve: 0, leave: FULL_LEAVE_MM },
        tasks: appendMemoTask(day.tasks, '외근', '휴일 M/M 0.8125'),
      },
      false
    );
  }
  if (preset === 'trip') {
    return withPublicHolidayOverride(
      {
        ...day,
        holiday: true,
        mm: { work: 0, improve: 0, leave: FULL_LEAVE_MM },
        tasks: appendMemoTask(day.tasks, '출장', '휴일 M/M 0.8125'),
      },
      false
    );
  }
  if (preset === 'half-am' || preset === 'half-pm') {
    const label = preset === 'half-am' ? '오전 반차' : '오후 반차';
    const tasks = [...day.tasks];
    if (!tasks.some((t) => t.title.includes('반차'))) {
      tasks.push({
        id: `t-leave-${Date.now()}`,
        cat: 'other',
        title: label,
        plan: 0,
        actual: 0,
        done: true,
        note: '휴일 M/M 0.40625',
      });
    }
    return withPublicHolidayOverride(
      { ...day, holiday: false, mm: { ...day.mm, leave: HALF_LEAVE_MM }, tasks },
      true
    );
  }
  if (preset === 'quarter') {
    const tasks = [...day.tasks];
    if (!tasks.some((t) => t.title.includes('반반차'))) {
      tasks.push({
        id: `t-leave-${Date.now()}`,
        cat: 'other',
        title: '반반차',
        plan: 0,
        actual: 0,
        done: true,
        note: '휴일 M/M 0.203125',
      });
    }
    return withPublicHolidayOverride(
      { ...day, holiday: false, mm: { ...day.mm, leave: 0.203125 }, tasks },
      true
    );
  }
  if (preset === 'clear') {
    return withPublicHolidayOverride(
      { ...day, holiday: false, mm: { work: 0, improve: 0, leave: 0 }, tasks: day.tasks },
      true
    );
  }
  return null;
}
