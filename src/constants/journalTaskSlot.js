/** 업무 시간대: 오전 / 오후 (미지정 가능) */
export const JOURNAL_TASK_SLOTS = [
  { value: '', label: '미지정' },
  { value: 'am', label: '오전' },
  { value: 'pm', label: '오후' },
];

const SLOT_ORDER = { am: 0, pm: 1, '': 2 };

export function normalizeTaskSlot(slot) {
  return slot === 'am' || slot === 'pm' ? slot : '';
}

export function getTaskSlotLabel(slot) {
  if (slot === 'am') return '오전';
  if (slot === 'pm') return '오후';
  return '';
}

export function resolveTaskSlotField(slot) {
  const s = normalizeTaskSlot(slot);
  return s || undefined;
}

/** 일자 셀: 오전 → 오후 → 미지정 순, 같은 구간 내 입력 순 유지 */
export function sortTasksBySlot(tasks) {
  return tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const oa = SLOT_ORDER[normalizeTaskSlot(a.t.slot)] ?? 2;
      const ob = SLOT_ORDER[normalizeTaskSlot(b.t.slot)] ?? 2;
      return oa - ob || a.i - b.i;
    })
    .map(({ t }) => t);
}
