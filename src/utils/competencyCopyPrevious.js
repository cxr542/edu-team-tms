import { COMPETENCY_DIM_IDS } from '../constants/competencyRubric';
import { isValidCompetencyIntLevel } from './competencyScore';

const MAX_LOOKBACK_MONTHS = 24;

/** 월 인덱스(0-11) 기준으로 n개월 이전의 {year, monthIndex} */
export function shiftMonth(year, monthIndex, back) {
  const total = year * 12 + monthIndex - back;
  return { year: Math.floor(total / 12), monthIndex: ((total % 12) + 12) % 12 };
}

/** 정수레벨·충족 여부·근거·링크 중 하나라도 입력되어 있는가 (자체평가 근거 메모/제출 상태는 제외) */
export function hasSelfLevelInput(self, dimIds = COMPETENCY_DIM_IDS) {
  if (!self) return false;
  if (isValidCompetencyIntLevel(self.intLevel)) return true;
  return dimIds.some(
    (id) => self.dims?.[id] === 'met' || self.dimEvidences?.[id] || self.dimLinks?.[id]
  );
}

/**
 * 직전 달부터 거슬러 올라가며 가져올 수 있는 가장 최근 월 자체평가를 찾는다 (읽기 전용).
 * @returns {{ year: number, monthIndex: number, self: object } | null}
 */
export function findPreviousSelfSource(getMonthRecord, year, monthIndex, maxLookback = MAX_LOOKBACK_MONTHS) {
  for (let back = 1; back <= maxLookback; back += 1) {
    const t = shiftMonth(year, monthIndex, back);
    const self = getMonthRecord(t.year, t.monthIndex)?.self;
    if (isValidCompetencyIntLevel(self?.intLevel)) return { ...t, self };
  }
  return null;
}

/** 현재 직군에 존재하는 차원 ID 기준으로 일치하는 차원만 patch에 담는다. */
export function buildCopyPatch(sourceSelf, dimIds = COMPETENCY_DIM_IDS) {
  const pick = (obj) =>
    Object.fromEntries(dimIds.filter((id) => obj && id in obj).map((id) => [id, obj[id]]));
  return {
    intLevel: sourceSelf.intLevel,
    dims: pick(sourceSelf.dims),
    dimEvidences: pick(sourceSelf.dimEvidences),
    dimLinks: pick(sourceSelf.dimLinks),
  };
}
