import {
  ACCUMULATION_ORDER_BY_ROLE,
  COMPETENCY_DIM_IDS,
  DIM_MET,
  accumulationOrderForRole,
} from '../constants/competencyRubric';
import {
  COMPETENCY_CAP_DEFAULT,
  COMPETENCY_CAP_RELEASE,
  COMPETENCY_USE_4060,
} from '../constants/competencyConfig';

/** @param {Record<string, string>} dims */
export function isDimsComplete(dims) {
  return COMPETENCY_DIM_IDS.every((id) => dims[id] === DIM_MET || dims[id] === 'unmet');
}

/**
 * 소수 누적 (선행 차원 충족 시 +0.2)
 * @param {Record<string, string>} dims
 * @param {string[]} [order]
 */
export function accumulateFractional(dims, order = ACCUMULATION_ORDER_BY_ROLE.default) {
  if (!dims || !isDimsComplete(dims)) return null;
  let total = 0;
  for (let i = 0; i < order.length; i += 1) {
    const chainMet = order.slice(0, i + 1).every((id) => dims[id] === DIM_MET);
    if (!chainMet) break;
    total += 0.2;
  }
  return Math.round(total * 10) / 10;
}

/**
 * 캡 적용 (설계노트 §6)
 * @param {number|null} accumulated
 * @param {Record<string, string>} dims
 * @param {string} roleId
 */
export function applyCap(accumulated, dims, roleId = 'default') {
  if (accumulated == null) return null;
  let cap = COMPETENCY_CAP_RELEASE;
  if (roleId === 'instructor') {
    cap = dims.quality === DIM_MET && dims.expertise === DIM_MET ? COMPETENCY_CAP_RELEASE : COMPETENCY_CAP_DEFAULT;
  } else if (roleId === 'planner') {
    cap = dims.collaboration === DIM_MET ? COMPETENCY_CAP_RELEASE : COMPETENCY_CAP_DEFAULT;
  } else {
    cap = dims.quality === DIM_MET ? COMPETENCY_CAP_RELEASE : COMPETENCY_CAP_DEFAULT;
  }
  return Math.min(accumulated, cap);
}

/** Excel MROUND(value, 0.2) */
export function mround02(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value / 0.2) * 0.2;
}

/** 제안 종합 = 정수레벨 + MROUND(캡적용) */
export function proposedComposite(intLevel, fractionalMround) {
  const base = Number(intLevel) || 0;
  const frac = fractionalMround == null ? 0 : Number(fractionalMround);
  return Math.round((base + frac) * 10) / 10;
}

/** 평가 한 건 전체 계산 */
export function computeCompetencyEval({ intLevel, dims, roleId = 'default' }) {
  const order = accumulationOrderForRole(roleId);
  const accumulated = accumulateFractional(dims, order);
  const capped = applyCap(accumulated, dims, roleId);
  const fractional = mround02(capped);
  const proposed = proposedComposite(intLevel, fractional);
  return { accumulated, capped, fractional, proposed };
}

/** 40:60 월간 최종 (옵션) */
export function monthlyFinalScore(selfProposed, mgrProposed, use4060 = COMPETENCY_USE_4060) {
  const self = Number(selfProposed) || 0;
  const mgr = Number(mgrProposed) || 0;
  if (!use4060) return mgr;
  return Math.round((self * 0.4 + mgr * 0.6) * 10) / 10;
}

/** 분기 월간 점수 평균 → KPI3 level */
export function quarterAverageLevel(monthScores) {
  const nums = monthScores.filter((n) => n != null && !Number.isNaN(n));
  if (!nums.length) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.round(avg * 100) / 100;
}

/** year + monthIndex(0-based) → 해당 분기 3개월 ym 키 */
export function quarterMonthKeys(year, monthIndex) {
  const q = Math.floor(monthIndex / 3);
  const startMonth = q * 3;
  return [0, 1, 2].map((i) => `${year}-${String(startMonth + i + 1).padStart(2, '0')}`);
}

/** competencyMonths에서 분기 level 롤업 */
export function rollupQuarterLevelFromMonths(competencyMonths, year, monthIndex, memberCode, use4060) {
  const yms = quarterMonthKeys(year, monthIndex);
  const scores = yms.map((ym) => {
    const rec = competencyMonths?.[ym]?.[memberCode];
    if (!rec) return null;
    const selfScore = rec.self?.computed?.proposed ?? null;
    const mgrScore = rec.manager?.computed?.proposed ?? null;
    if (rec.managerLocked && mgrScore != null) {
      return monthlyFinalScore(selfScore, mgrScore, use4060 ?? COMPETENCY_USE_4060);
    }
    return null;
  });
  return quarterAverageLevel(scores);
}
