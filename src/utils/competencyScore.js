import {
  ACCUMULATION_ORDER_BY_ROLE,
  COMPETENCY_DIM_IDS,
  DIM_MET,
  DIM_UNMET,
  accumulationOrderForRole,
  defaultCompetencyDims,
} from '../constants/competencyRubric';
import {
  COMPETENCY_CAP_DEFAULT,
  COMPETENCY_CAP_RELEASE,
  COMPETENCY_USE_4060,
} from '../constants/competencyConfig';

/** 빈 값·null·undefined → 미충족 */
export function coerceDimStatus(value) {
  return value === DIM_MET ? DIM_MET : DIM_UNMET;
}

/**
 * dims 정규화: 빈 값 보정 + 연속 충족 체인 (직군 누적 순서 기준)
 * 상위(선행) 차원이 unmet이면 이후 차원은 모두 unmet
 */
export function normalizeDimsChain(dims, roleId = 'default') {
  const order = accumulationOrderForRole(roleId);
  const merged = { ...defaultCompetencyDims(), ...(dims || {}) };
  const result = {};
  for (const id of COMPETENCY_DIM_IDS) {
    result[id] = coerceDimStatus(merged[id]);
  }
  let chainBroken = false;
  for (const id of order) {
    if (chainBroken) {
      result[id] = DIM_UNMET;
    } else if (result[id] !== DIM_MET) {
      result[id] = DIM_UNMET;
      chainBroken = true;
    }
  }
  return result;
}

/**
 * UI 차원 변경 — met: 해당 단계까지 상위 연속 met + 이후 unmet
 * unmet: 해당 차원 및 하위(누적 순서) unmet
 */
export function applyDimChange(currentDims, dimId, value, roleId = 'default') {
  const order = accumulationOrderForRole(roleId);
  const idx = order.indexOf(dimId);
  const next = { ...defaultCompetencyDims(), ...(currentDims || {}) };
  if (idx < 0) return normalizeDimsChain(next, roleId);

  if (value === DIM_MET) {
    for (let i = 0; i <= idx; i += 1) next[order[i]] = DIM_MET;
    for (let i = idx + 1; i < order.length; i += 1) next[order[i]] = DIM_UNMET;
  } else {
    for (let i = idx; i < order.length; i += 1) next[order[i]] = DIM_UNMET;
  }
  return normalizeDimsChain(next, roleId);
}

/** @param {Record<string, string>} dims */
export function isDimsComplete(dims) {
  return COMPETENCY_DIM_IDS.every((id) => {
    const v = dims?.[id];
    return v === DIM_MET || v === DIM_UNMET;
  });
}

/** 연속 충족 단계 수 (누적 순서 기준, 0~5) */
export function countConsecutiveMetFromStart(dims, roleId = 'default') {
  const order = accumulationOrderForRole(roleId);
  const normalized = normalizeDimsChain(dims, roleId);
  let count = 0;
  for (const id of order) {
    if (normalized[id] === DIM_MET) count += 1;
    else break;
  }
  return count;
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

/** 제안 종합 = 정수레벨 + fractional (fractional이 null이면 정수만) */
export function proposedComposite(intLevel, fractionalMround) {
  const base = Number(intLevel) || 0;
  if (fractionalMround == null) return base;
  return Math.round((base + Number(fractionalMround)) * 10) / 10;
}

export function mergeCompetencyEvalSidePatch(existingSide, patch = {}, roleId = 'default') {
  const mergedDims = {
    ...defaultCompetencyDims(),
    ...(existingSide?.dims || {}),
    ...(patch.dims || {}),
  };
  return {
    intLevel: patch.intLevel ?? existingSide?.intLevel ?? 0,
    dims: normalizeDimsChain(mergedDims, roleId),
  };
}

/** intLevel + dims 정규화 후 computed 재계산 */
export function normalizeCompetencyEvalSide(side, roleId = 'default') {
  const merged = mergeCompetencyEvalSidePatch(side, {}, roleId);
  const computed = computeCompetencyEval({
    intLevel: merged.intLevel,
    dims: merged.dims,
    roleId,
  });
  return { ...merged, computed };
}

/** 평가 한 건 전체 계산 (dims는 normalize 후 항상 complete, fractional은 숫자) */
export function computeCompetencyEval({ intLevel, dims, roleId = 'default' }) {
  const base = Number(intLevel) || 0;
  const normalizedDims = normalizeDimsChain(dims, roleId);
  const order = accumulationOrderForRole(roleId);
  const accumulated = accumulateFractional(normalizedDims, order);
  const capped = applyCap(accumulated, normalizedDims, roleId);
  const fractional = mround02(capped);
  const proposed = proposedComposite(base, fractional);
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
