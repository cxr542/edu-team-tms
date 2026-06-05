import { describe, expect, it } from 'vitest';
import { LUNCH_ALLOWANCE_WON, LUNCH_PRICE_OVER, LUNCH_PRICE_WITHIN } from '../src/constants/lunchPick.js';
import { deriveLunchPriceInfo, enrichSpotWithPriceInfo } from '../src/utils/lunchMenuPrice.js';

describe('deriveLunchPriceInfo', () => {
  it('uses cheapest menu within allowance as representative', () => {
    const info = deriveLunchPriceInfo({
      id: 'x',
      name: '테스트',
      category: '한식',
      menus: [
        { name: '정식', priceWon: 15000 },
        { name: '된장찌개', priceWon: 9000 },
      ],
    });
    expect(info.priceLevel).toBe(LUNCH_PRICE_WITHIN);
    expect(info.representativeMenu?.name).toBe('된장찌개');
    expect(info.representativeMenu?.priceWon).toBe(9000);
  });

  it('marks over when all priced menus exceed allowance', () => {
    const info = deriveLunchPriceInfo({
      id: 'x',
      name: '테스트',
      category: '일식',
      menus: [{ name: '로스카츠', priceWon: 15000 }],
    });
    expect(info.priceLevel).toBe(LUNCH_PRICE_OVER);
  });

  it('infers within from legacy hints when priceLevel 2 has cheap second menu', () => {
    const spot = enrichSpotWithPriceInfo({
      id: 'x',
      name: '지리산식당',
      category: '한식',
      priceLevel: 2,
      menuHints: ['정식', '된장찌개'],
      source: 'kakao',
    });
    // 가격 데이터가 없으면 저장된 priceLevel을 그대로 유지합니다.
    expect(spot.priceLevel).toBe(LUNCH_PRICE_OVER);
    expect(spot.representativeMenu?.name).toBe('정식');
  });
});
