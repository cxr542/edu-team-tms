import React, { useMemo } from 'react';
import { buildTeamKpiCoaching } from '../utils/teamKpiCoaching';
import KpiCoachingReportView from './KpiCoachingReportView';

export default function TeamKpiCoachingReport({ team, monthly, quarterly, yq }) {
  const report = useMemo(
    () => buildTeamKpiCoaching(team, monthly, quarterly, { yq }),
    [team, monthly, quarterly, yq]
  );

  return (
    <KpiCoachingReportView
      report={report}
      title="팀 KPI 평가 분석 · 본부 목표 달성 제안"
      ariaLabel="팀 KPI 평가 분석"
    />
  );
}
