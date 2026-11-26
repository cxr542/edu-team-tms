import { describe, expect, it } from 'vitest';
import { approveSubmissionsInOrder, formatLocalDateTime } from '../src/utils/guideSubmissionBatch.js';

describe('approveSubmissionsInOrder', () => {
  const items = [
    { id: 'sub-1', title: '하나' },
    { id: 'sub-2', title: '둘' },
    { id: 'sub-3', title: '셋' },
  ];

  it('approves one by one in order and reports progress', async () => {
    const calls = [];
    const progress = [];
    const out = await approveSubmissionsInOrder(
      items,
      async (id) => (calls.push(id), { ok: true, data: { id: `lecture-u-${id}` } }),
      (done, total) => progress.push(`${done}/${total}`)
    );
    expect(calls).toEqual(['sub-1', 'sub-2', 'sub-3']);
    expect(progress).toEqual(['1/3', '2/3', '3/3']);
    expect(out).toEqual({ approvedIds: ['lecture-u-sub-1', 'lecture-u-sub-2', 'lecture-u-sub-3'], failed: [] });
  });

  it('keeps going after a failure or a thrown error and collects the reasons', async () => {
    const out = await approveSubmissionsInOrder(items, async (id) => {
      if (id === 'sub-1') return { ok: false, message: '크기 초과' };
      if (id === 'sub-2') throw new Error('끊김');
      return { ok: true, data: { id: 'lecture-u-3' } };
    });
    expect(out.approvedIds).toEqual(['lecture-u-3']);
    expect(out.failed).toEqual([
      { id: 'sub-1', title: '하나', message: '크기 초과' },
      { id: 'sub-2', title: '둘', message: '끊김' },
    ]);
  });

  it('does nothing for an empty list', async () => {
    expect(await approveSubmissionsInOrder([], async () => ({ ok: true }))).toEqual({ approvedIds: [], failed: [] });
  });
});

describe('formatLocalDateTime', () => {
  it('formats in the viewer time zone, not the raw UTC string', () => {
    const iso = '2026-11-13T06:07:00Z';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    expect(formatLocalDateTime(iso)).toBe(
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    );
    expect(formatLocalDateTime('')).toBe('');
    expect(formatLocalDateTime('nope')).toBe('');
  });
});
