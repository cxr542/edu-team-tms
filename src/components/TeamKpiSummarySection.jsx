import React, { useMemo } from 'react';
import { buildTeamMonthlyReport, buildTeamQuarterReport } from '../utils/kpiReportData';
import { buildTeamIntegratedSummary } from '../utils/teamKpiAggregate';
import { formatKpiMemberLabel } from '../constants/kpiMembers';
import { formatKpiStatusLabel } from '../constants/kpiStatuses';
import { KPI1_NAME, KPI2_NAME, KPI3_NAME } from '../constants/kpiDisplayNames';
import { KPI3_ELEMENTS } from '../constants/kpi3Elements';
import TeamKpiIntegratedSummary from './TeamKpiIntegratedSummary';
import './TeamKpiSummarySection.css';

function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

export default function TeamKpiSummarySection({
  year,
  month,
  yq,
  getMemberDays,
  kpiOperational,
  improveProjects,
  selectedMemberCode,
  onSelectMember,
}) {
  const monthly = useMemo(
    () =>
      buildTeamMonthlyReport({
        year,
        monthIndex: month,
        getMemberDays,
        kpiOperational,
        improveProjects,
      }),
    [year, month, getMemberDays, kpiOperational, improveProjects]
  );

  const quarterly = useMemo(
    () => buildTeamQuarterReport({ year, monthIndex: month, kpiOperational }),
    [year, month, kpiOperational]
  );

  const team = useMemo(() => buildTeamIntegratedSummary(monthly, quarterly), [monthly, quarterly]);

  return (
    <TeamKpiIntegratedSummary year={year} month={month} yq={yq} monthly={monthly} quarterly={quarterly}>
      <p className="team-kpi-hint team-kpi-summary-hint">아래 표에서 구성원을 선택하면 상세가 열립니다.</p>
      <div className="team-kpi-summary-tables">
        <p className="team-kpi-hint team-kpi-summary-hint" style={{ marginTop: 0 }}>
          KPI2 * = 승인 전 효과 건 포함(구성원 카드와 동일). 공식 집계는 승인 건만.
        </p>
        <div className="team-kpi-summary-block">
          <h3>월간 KPI (구성원별)</h3>
          <table className="team-kpi-table team-kpi-summary-table">
            <thead>
              <tr>
                <th>구성원</th>
                <th>{KPI1_NAME}</th>
                <th>등급</th>
                <th>{KPI2_NAME}</th>
                <th>등급</th>
                <th>월 확정</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => (
                <tr
                  key={row.member.code}
                  className={`team-kpi-summary-row${selectedMemberCode === row.member.code ? ' is-selected' : ''}`}
                  onClick={() => onSelectMember(row.member.code)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMember(row.member.code);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${formatKpiMemberLabel(row.member)} 상세 보기`}
                >
                  <td>{formatKpiMemberLabel(row.member)}</td>
                  <td>{formatPct(row.kpi1.utilization)}</td>
                  <td>
                    <span className={`kpi-grade kpi-grade--${row.grade1}`}>{row.grade1}</span>
                  </td>
                  <td>
                    {formatPct(row.kpi2DisplayPct)}
                    {row.kpi2UsesPreview ? ' *' : ''}
                  </td>
                  <td>
                    <span className={`kpi-grade kpi-grade--${row.grade2}`}>{row.grade2}</span>
                  </td>
                  <td>{formatKpiStatusLabel(row.status)}</td>
                </tr>
              ))}
              <tr className="team-kpi-summary-row team-kpi-summary-row--team">
                <td>
                  <strong>팀 통합</strong>
                </td>
                <td>{formatPct(team.kpi1.utilization)}</td>
                <td>
                  <span className={`kpi-grade kpi-grade--${team.grade1}`}>{team.grade1}</span>
                </td>
                <td>
                  {formatPct(team.kpi2.displayPct)}
                  {team.kpi2.usesPreview ? ' *' : ''}
                </td>
                <td>
                  <span className={`kpi-grade kpi-grade--${team.grade2}`}>{team.grade2}</span>
                </td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="team-kpi-summary-block">
          <h3>분기 {KPI3_NAME} (구성원별)</h3>
          <table className="team-kpi-table team-kpi-summary-table">
            <thead>
              <tr>
                <th>구성원</th>
                {KPI3_ELEMENTS.map((el) => (
                  <th key={el.key}>
                    {el.label}
                    <span className="team-kpi-th-weight">({el.weightPct}%)</span>
                  </th>
                ))}
                <th>종합</th>
                <th>등급</th>
              </tr>
            </thead>
            <tbody>
              {quarterly.map((row) => (
                <tr
                  key={row.member.code}
                  className={`team-kpi-summary-row${selectedMemberCode === row.member.code ? ' is-selected' : ''}`}
                  onClick={() => onSelectMember(row.member.code)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMember(row.member.code);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <td>{formatKpiMemberLabel(row.member)}</td>
                  {KPI3_ELEMENTS.map((el) => (
                    <td key={el.key}>{row.breakdown?.[el.key] > 0 ? row.breakdown[el.key] : '—'}</td>
                  ))}
                  <td>{row.quarter.composite > 0 ? row.quarter.composite : '—'}</td>
                  <td>
                    <span className={`kpi-grade kpi-grade--${row.grade3}`}>{row.grade3}</span>
                  </td>
                </tr>
              ))}
              <tr className="team-kpi-summary-row team-kpi-summary-row--team">
                <td>
                  <strong>팀 통합</strong>
                </td>
                {KPI3_ELEMENTS.map((el) => (
                  <td key={el.key}>{team.kpi3[el.key] > 0 ? team.kpi3[el.key] : '—'}</td>
                ))}
                <td>{team.kpi3.composite > 0 ? team.kpi3.composite : '—'}</td>
                <td>
                  <span className={`kpi-grade kpi-grade--${team.grade3}`}>{team.grade3}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </TeamKpiIntegratedSummary>
  );
}
