import { describe, expect, it } from 'vitest';
import {
  NAV_GROUP_DEFAULT_ORDER,
  applyNavOrder,
  moveNavItem,
  sanitizeNavOrder,
} from '../src/utils/navOrder.js';

describe('applyNavOrder', () => {
  const defaults = ['a', 'b', 'c', 'd'];

  it('keeps the default order when nothing is saved', () => {
    expect(applyNavOrder(defaults, undefined)).toEqual(defaults);
    expect(applyNavOrder(defaults, [])).toEqual(defaults);
  });

  it('puts the saved order first and appends menus that are not saved yet', () => {
    expect(applyNavOrder(defaults, ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('drops menus that no longer exist and duplicates', () => {
    expect(applyNavOrder(defaults, ['x', 'b', 'b', 'a'])).toEqual(['b', 'a', 'c', 'd']);
  });
});

describe('moveNavItem', () => {
  it('moves an item up or down by one', () => {
    expect(moveNavItem(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveNavItem(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('does nothing at the ends or for an unknown id', () => {
    const order = ['a', 'b', 'c'];
    expect(moveNavItem(order, 'a', -1)).toBe(order);
    expect(moveNavItem(order, 'c', 1)).toBe(order);
    expect(moveNavItem(order, 'z', 1)).toBe(order);
  });
});

describe('sanitizeNavOrder', () => {
  it('keeps only known groups with string ids', () => {
    expect(sanitizeNavOrder({ common: ['ledger', 3], nope: ['x'], leader: 'kpi' })).toEqual({
      common: ['ledger'],
    });
    expect(sanitizeNavOrder(null)).toEqual({});
    expect(sanitizeNavOrder([])).toEqual({});
  });
});

describe('default order', () => {
  it('lists each admin menu exactly once', () => {
    const all = Object.values(NAV_GROUP_DEFAULT_ORDER).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
