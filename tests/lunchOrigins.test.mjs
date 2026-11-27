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

describe('resolveOrigin radius override', () => {
  it('프리셋도 저장된 radiusM 으로 반경을 넓힐 수 있고, 여의도 팀 목록은 그대로 쓴다', async () => {
    const { resolveOrigin } = await import('../src/hooks/useLunchOrigin.js');
    expect(resolveOrigin(null).radiusM).toBe(DEFAULT_LUNCH_ORIGIN.radiusM);
    const wide = resolveOrigin({ presetId: DEFAULT_LUNCH_ORIGIN.id, radiusM: 3000 });
    expect(wide.radiusM).toBe(3000);
    expect(wide.center).toEqual(DEFAULT_LUNCH_ORIGIN.center);
    expect(usesYeouidoSeedCatalog(wide)).toBe(true);
    expect(resolveOrigin({ presetId: 'yeouido-station', radiusM: 2000 }).radiusM).toBe(2000);
    expect(resolveOrigin({ presetId: DEFAULT_LUNCH_ORIGIN.id, radiusM: -1 }).radiusM).toBe(DEFAULT_LUNCH_ORIGIN.radiusM);
  });

  it('직접 지정은 customRadiusM 을 쓴다', async () => {
    const { resolveOrigin } = await import('../src/hooks/useLunchOrigin.js');
    const o = resolveOrigin({ presetId: CUSTOM_ORIGIN_PRESET_ID, customLabel: '발산역', customLat: 37.55, customLng: 126.84, customRadiusM: 2500 });
    expect(o.radiusM).toBe(2500);
  });
});
