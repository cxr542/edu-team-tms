import { JOURNAL_CAT_ORDER } from '../constants/journalCategories';
import {
  DM_DUAL_DEFAULT_LECTURE_WEIGHT,
  DM_DUAL_LECTURE_WEIGHT_MAX,
  DM_DUAL_LECTURE_WEIGHT_MIN,
  DM_WEIGHT_MODE_JOURNAL,
  DM_WEIGHT_MODE_MANUAL,
} from '../constants/kpi3DmProfile';

export { DM_WEIGHT_MODE_JOURNAL, DM_WEIGHT_MODE_MANUAL } from '../constants/kpi3DmProfile';
import { quarterMonthKeys } from './competencyScore';
import { getWeeksInMonth, dateKey } from './journalMm';
import { LEAVE_MEMO_TASK_RE } from './journalLeavePresets';

/** 일지 카테고리 → 다면 강의 축 M/M */
export const DM_LECTURE_JOURNAL_CATS = new Set(['edu', 'prep']);

/** 일지 카테고리 → 다면 운영·기획 축 M/M */
export const DM_OPS_JOURNAL_CATS = new Set(['other']);

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** @param {string|number} [pct] */
export function clampManualLecturePct(pct) {
  if (pct === '' || pct == null) return Math.round(DM_DUAL_DEFAULT_LECTURE_WEIGHT * 100);
  const n = Number(pct);
  if (Number.isNaN(n)) return Math.round(DM_DUAL_DEFAULT_LECTURE_WEIGHT * 100);
  return Math.min(
    Math.round(DM_DUAL_LECTURE_WEIGHT_MAX * 100),
    Math.max(Math.round(DM_DUAL_LECTURE_WEIGHT_MIN * 100), Math.round(n))
  );
}

/**
 * 분기 일지 실작업시간으로 겸업 다면 가중 산출
 * @param {(key: string, memberCode?: string) => object} getDayData
 */
export function computeQuarterDmActivityWeights(getDayData, year, monthIndex, memberCode) {
  const yms = quarterMonthKeys(year, monthIndex);
  let lectureH = 0;
  let opsH = 0;

  yms.forEach((ym) => {
    const y = parseInt(ym.slice(0, 4), 10);
    const monthIdx = parseInt(ym.slice(5, 7), 10) - 1;
    const weeks = getWeeksInMonth(y, monthIdx);
    weeks.forEach((week) => {
      week.days.forEach((d) => {
        const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        const data = getDayData(key, memberCode);
        if (!data?.tasks?.length) return;
        data.tasks.forEach((t) => {
          if (LEAVE_MEMO_TASK_RE.test(t.title || '')) return;
          const h = Number(t.actual) || 0;
          if (h <= 0) return;
          const cat = t.cat || 'other';
          if (DM_LECTURE_JOURNAL_CATS.has(cat)) lectureH += h;
          else if (DM_OPS_JOURNAL_CATS.has(cat)) opsH += h;
          else if (JOURNAL_CAT_ORDER.includes(cat)) opsH += h;
        });
      });
    });
  });

  const total = lectureH + opsH;
  if (total <= 0) {
    return {
      lectureWeight: DM_DUAL_DEFAULT_LECTURE_WEIGHT,
      opsWeight: round2(1 - DM_DUAL_DEFAULT_LECTURE_WEIGHT),
      lectureHours: 0,
      opsHours: 0,
      source: 'default',
      rawLecturePct: null,
    };
  }

  const rawPct = round2((lectureH / total) * 100);
  let lectureWeight = lectureH / total;
  lectureWeight = Math.max(
    DM_DUAL_LECTURE_WEIGHT_MIN,
    Math.min(DM_DUAL_LECTURE_WEIGHT_MAX, lectureWeight)
  );

  return {
    lectureWeight: round2(lectureWeight),
    opsWeight: round2(1 - lectureWeight),
    lectureHours: round2(lectureH),
    opsHours: round2(opsH),
    source: 'journal',
    rawLecturePct: rawPct,
  };
}

/**
 * 겸업: 일지 자동 vs 팀장 수동 가중 확정
 * @param {ReturnType<computeQuarterDmActivityWeights>|null} journalWeights
 * @param {{ weightMode?: string, manualLecturePct?: string|number }} [dmDetail]
 */
export function resolveDualDmWeights(journalWeights, dmDetail) {
  const journal = journalWeights || {
    lectureWeight: DM_DUAL_DEFAULT_LECTURE_WEIGHT,
    opsWeight: round2(1 - DM_DUAL_DEFAULT_LECTURE_WEIGHT),
    lectureHours: 0,
    opsHours: 0,
    source: 'default',
    rawLecturePct: null,
  };

  if (dmDetail?.weightMode === DM_WEIGHT_MODE_MANUAL) {
    const pct = clampManualLecturePct(dmDetail.manualLecturePct);
    return {
      lectureWeight: round2(pct / 100),
      opsWeight: round2(1 - pct / 100),
      lecturePct: pct,
      opsPct: 100 - pct,
      source: DM_WEIGHT_MODE_MANUAL,
      journal,
    };
  }

  return {
    lectureWeight: journal.lectureWeight,
    opsWeight: journal.opsWeight,
    lecturePct: Math.round(journal.lectureWeight * 100),
    opsPct: Math.round(journal.opsWeight * 100),
    source: DM_WEIGHT_MODE_JOURNAL,
    journal,
  };
}
