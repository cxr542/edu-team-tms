import React from 'react';
import { KPI3_ELEMENT_KEYS, countKpi3ElementsEntered } from '../utils/kpiGrades';

/** 4요소 중 일부만 입력된 분기 종합(잠정 값) 표시 */
export default function Kpi3PartialNote({ source, block = false }) {
  const entered = countKpi3ElementsEntered(source);
  if (entered === 0 || entered === KPI3_ELEMENT_KEYS.length) return null;
  const Tag = block ? 'p' : 'span';
  return (
    <Tag
      className="kpi3-partial-note"
      title="레벨·다면·리더·실전 4요소 중 일부만 입력되어 종합은 잠정 값입니다. 미입력 요소는 0으로 계산됩니다."
    >
      일부 요소 미입력 ({entered}/{KPI3_ELEMENT_KEYS.length}) · 잠정
    </Tag>
  );
}
