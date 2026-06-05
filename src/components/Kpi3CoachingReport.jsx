import React, { useMemo } from 'react';
import { buildKpi3Coaching } from '../utils/kpi3Coaching';
import Kpi3HqTargetTable from './Kpi3HqTargetTable';
import KpiCoachingReportView from './KpiCoachingReportView';

export default function Kpi3CoachingReport({
  quarter,
  yq,
  memberLabel,
  context = {},
  showHqTable = true,
}) {
  const report = useMemo(
    () =>
      buildKpi3Coaching(quarter, {
        yq,
        memberLabel,
        ...context,
      }),
    [quarter, yq, memberLabel, context]
  );

  const composite =
    quarter?.composite > 0 ? quarter.composite : report.composite > 0 ? report.composite : 0;

  return (
    <>
      <KpiCoachingReportView report={report} ariaLabel="KPI3 평가 분석" />
      {showHqTable && <Kpi3HqTargetTable yq={yq} currentComposite={composite} />}
    </>
  );
}
