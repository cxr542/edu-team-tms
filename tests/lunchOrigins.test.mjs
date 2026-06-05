import { describe, expect, it } from 'vitest';
import {
  CUSTOM_ORIGIN_PRESET_ID,
  DEFAULT_LUNCH_ORIGIN,
  formatRadiusKm,
  isNearYeouidoPreset,
  kmToRadiusM,
  radiusMToKm,
  usesYeouidoSeedCatalog,
} from '../src/constants/lunchOrigins.js';

describe('lunchOrigins radius km', () => {
  it('converts meters to km label', () => {
    expect(formatRadiusKm(1000)).toBe('1km');
    expect(formatRadiusKm(1500)).toBe('1.5km');
  });

  it('converts km input to meters', () => {
    expect(kmToRadiusM(1)).toBe(1000);
    expect(kmToRadiusM(1.5)).toBe(1500);
  });

  it('radiusMToKm defaults invalid to 1', () => {
    expect(radiusMToKm(0)).toBe(1);
  });
});

describe('usesYeouidoSeedCatalog', () => {
  it('true for yeouido presets only', () => {
    expect(usesYeouidoSeedCatalog(DEFAULT_LUNCH_ORIGIN)).toBe(true);
    expect(
      usesYeouidoSeedCatalog({
        id: CUSTOM_ORIGIN_PRESET_ID,
        center: DEFAULT_LUNCH_ORIGIN.center,
      })
    ).toBe(true);
    expect(
      usesYeouidoSeedCatalog({
        id: CUSTOM_ORIGIN_PRESET_ID,
        center: { lat: 37.3898, lng: 126.9508 },
      })
    ).toBe(false);
  });
});

describe('isNearYeouidoPreset', () => {
  it('detects parc1 tower coordinates', () => {
    expect(isNearYeouidoPreset(DEFAULT_LUNCH_ORIGIN.center)).toBe(true);
  });
});
