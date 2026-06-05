import {
  LUNCH_ALLOWANCE_WON,
  LUNCH_PRICE_OVER,
  LUNCH_PRICE_UNKNOWN,
  LUNCH_PRICE_WITHIN,
} from '../constants/lunchPick.js';

/**
 * @typedef {{ name: string, priceWon?: number }} LunchMenuItem
 * @typedef {import('../hooks/useLunchSpots').LunchSpot & {
 *   menus?: LunchMenuItem[],
 *   representativeMenu?: LunchMenuItem | null,
 *   priceFromMenus?: boolean,
 * }} LunchSpotEnriched
 */

/**
 * @param {number} won
 */
export function formatMenuPrice(won) {
  return `${Number(won).toLocaleString('ko-KR')}원`;
}

/**
 * 시드에 menus가 없을 때 임시 가격을 추정하지 않습니다.
 * (사용자가 저장한 `priceLevel`을 그대로 표시하기 위함)
 * @param {import('../hooks/useLunchSpots').LunchSpot} spot
 */
export function attachEstimatedMenusIfMissing(spot) {
  return spot;
}

/**
 * @param {import('../hooks/useLunchSpots').LunchSpot} spot
 * @param {number} [allowanceWon]
 */
export function deriveLunchPriceInfo(spot, allowanceWon = LUNCH_ALLOWANCE_WON) {
  const menus = (spot.menus || []).filter((m) => m?.name);

  const priced = menus.filter((m) => Number.isFinite(m.priceWon) && m.priceWon > 0);
  const within = priced.filter((m) => m.priceWon <= allowanceWon);

  if (within.length > 0) {
    const representativeMenu = [...within].sort((a, b) => a.priceWon - b.priceWon)[0];
    return {
      priceLevel: LUNCH_PRICE_WITHIN,
      representativeMenu,
      priceFromMenus: priced.length > 0,
      isEstimated: !spot.menus?.length && priced.length > 0,
    };
  }

  if (priced.length > 0) {
    const representativeMenu = [...priced].sort((a, b) => a.priceWon - b.priceWon)[0];
    return {
      priceLevel: LUNCH_PRICE_OVER,
      representativeMenu,
      priceFromMenus: true,
      isEstimated: !spot.menus?.length,
    };
  }

  if (spot.priceLevel === LUNCH_PRICE_WITHIN || spot.priceLevel === LUNCH_PRICE_OVER) {
    const name = spot.menuHints?.[0] || null;
    return {
      priceLevel: spot.priceLevel,
      representativeMenu: name ? { name, priceWon: undefined } : null,
      priceFromMenus: false,
      isEstimated: false,
    };
  }

  return {
    priceLevel: LUNCH_PRICE_UNKNOWN,
    representativeMenu: null,
    priceFromMenus: false,
    isEstimated: false,
  };
}

/**
 * @param {import('../hooks/useLunchSpots').LunchSpot} spot
 * @param {number} [allowanceWon]
 * @returns {LunchSpotEnriched}
 */
export function enrichSpotWithPriceInfo(spot, allowanceWon = LUNCH_ALLOWANCE_WON) {
  const info = deriveLunchPriceInfo(spot, allowanceWon);
  return {
    ...attachEstimatedMenusIfMissing(spot),
    priceLevel: info.priceLevel,
    representativeMenu: info.representativeMenu,
    priceFromMenus: info.priceFromMenus,
    priceIsEstimated: info.isEstimated,
  };
}
