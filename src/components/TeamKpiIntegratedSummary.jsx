import React, { useMemo } from 'react';
import { buildDocsModuleUrl } from '../constants/referenceDocs';
import { getKpi3HqTargetForYq, KPI3_RESULT_GRADE_TABLE } from '../constants/kpi3HeadquartersGoals';
import { KPI1_GRADES, KPI2_GRADES } from '../constants/kpiRules';
import { KPI1_NAME, KPI2_NAME, KPI3_NAME } from '../constants/kpiDisplayNames';
import { KPI3_ELEMENTS } from '../constants/kpi3Elements';
import { buildTeamIntegratedSummary } from '../utils/teamKpiAggregate';
import Kpi3HqTargetTable from './Kpi3HqTargetTable';
import TeamKpiCoachingReport from './TeamKpiCoachingReport';
import './TeamKpiIntegratedSummary.css';

function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function formatScore(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(2);
}

function formatMm(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(2);
}

export default function TeamKpiIntegratedSummary({
  year,
  month,
  yq,
  monthly,
  quarterly,
  variant = 'manage',
  children,
}) {
  const team = useMemo(() => buildTeamIntegratedSummary(monthly, quarterly), [monthly, quarterly]);
  const hqTarget = getKpi3HqTargetForYq(yq);

  return (
    <section
      className={`team-kpi-integrated${variant === 'report' ? ' team-kpi-integrated--report' : ''}`}
      aria-label="팀 KPI 통합 요약"
    >
      <div className="team-kpi-integrated-head">
        <h2>{variant === 'report' ? '팀 KPI 통합 요약' : '팀 KPI 종합'}</h2>
        <p className="team-kpi-integrated-lead">
          {year}년 {month + 1}월 · 구성원 {team.memberCount}명 ·{' '}
          <a href={buildDocsModuleUrl('kpi-definition')} target="_blank" rel="noopener noreferrer">
            KPI 정의서
          </a>{' '}
          팀 통합 산식 (직군 구분 없이 팀 전체 측정)
        </p>
      </div>

      <div className="team-kpi-integrated-cards">
        <article className="team-kpi-integrated-card kpi1">
          <h3>{KPI1_NAME}</h3>
          <p className="team-kpi-integrated-big">{formatPct(team.kpi1.utilization)}</p>
          <p className="team-kpi-integrated-grade">
            팀 등급 <span className={`kpi-grade kpi-grade--${team.grade1}`}>{team.grade1}</span>
          </p>
          <ul className="team-kpi-integrated-mm">
            <li>업무 {formatMm(team.kpi1.work)}</li>
            <li>생산향상 {formatMm(team.kpi1.improve)}</li>
            <li>휴일 {formatMm(team.kpi1.leave)}</li>
            <li>가용 {formatMm(team.kpi1.available)}</li>
          </ul>
          <p className="team-kpi-integrated-formula">{team.kpi1.formula}</p>
        </article>

        <article className="team-kpi-integrated-card kpi2">
          <h3>{KPI2_NAME}</h3>
          <p className="team-kpi-integrated-big">{formatPct(team.kpi2.displayPct)}</p>
          <p className="team-kpi-integrated-grade">
            팀 등급 <span className={`kpi-grade kpi-grade--${team.grade2}`}>{team.grade2}</span>
            {team.kpi2.usesPreview && (
              <span className="team-kpi-hint-inline"> (승인 전 · 효과 건 기준)</span>
            )}
          </p>
          <p className="team-kpi-integrated-meta">
            {team.kpi2.usesPreview ? (
              <>
                미승인 포함 {team.kpi2.preview?.submittedCount ?? 0}건 · 승인{' '}
                {team.kpi2.submittedCount ?? 0}건
              </>
            ) : (
              <>승인 효과 {team.kpi2.submittedCount ?? 0}건</>
            )}
            {' · '}
            계획 {formatMm(team.kpi2.usesPreview ? team.kpi2.preview?.planSum : team.kpi2.planSum)}h / 실적{' '}
            {formatMm(team.kpi2.usesPreview ? team.kpi2.preview?.actualSum : team.kpi2.actualSum)}h
          </p>
          <p className="team-kpi-integrated-formula">{team.kpi2.formula}</p>
        </article>

        <article className="team-kpi-integrated-card kpi3">
          <h3>
            {KPI3_NAME} · {yq}
          </h3>
          <p className="team-kpi-integrated-big">{formatScore(team.kpi3.composite)}</p>
          <p className="team-kpi-integrated-grade">
            팀 등급 <span className={`kpi-grade kpi-grade--${team.grade3}`}>{team.grade3}</span>
          </p>
          <ul className="team-kpi-integrated-kpi3">
            {KPI3_ELEMENTS.map((el) => (
              <li key={el.key}>
                {el.label} {team.kpi3[el.key] > 0 ? team.kpi3[el.key] : '—'}
              </li>
            ))}
          </ul>
          {hqTarget?.minScore != null && team.kpi3.composite != null && (
            <p
              className={`team-kpi-integrated-meta${team.kpi3.composite >= hqTarget.minScore ? ' is-met' : ' is-gap'}`}
            >
              본부 {hqTarget.label} 목표 {hqTarget.minScore}점
              {team.kpi3.composite >= hqTarget.minScore
                ? ' · 달성'
                : ` · ${(hqTarget.minScore - team.kpi3.composite).toFixed(2)}점 부족`}
            </p>
          )}
          <p className="team-kpi-integrated-formula">{team.kpi3.formula}</p>
        </article>
      </div>

      {variant === 'report' && (
        <TeamKpiCoachingReport team={team} monthly={monthly} quarterly={quarterly} yq={yq} />
      )}

      {variant !== 'report' && (
        <details className="team-kpi-integrated-grades-ref">
          <summary>팀 KPI 결과 등급 기준 (정의서)</summary>
          <div className="team-kpi-integrated-grades-grid">
            <div>
              <h4>{KPI1_NAME}</h4>
              <table className="team-kpi-table team-kpi-integrated-ref-table">
                <thead>
                  <tr>
                    <th>등급</th>
                    <th>기준</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI1_GRADES.filter((g) => g.grade !== 'D').map((g) => (
                    <tr key={g.grade}>
                      <td>
                        <span className={`kpi-grade kpi-grade--${g.grade}`}>{g.grade}</span>
                      </td>
                      <td>{g.minPct}% 이상</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <span className="kpi-grade kpi-grade--D">D</span>
                    </td>
                    <td>90% 미만</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <h4>{KPI2_NAME}</h4>
              <table className="team-kpi-table team-kpi-integrated-ref-table">
                <thead>
                  <tr>
                    <th>등급</th>
                    <th>기준</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI2_GRADES.filter((g) => g.grade !== 'D').map((g) => (
                    <tr key={g.grade}>
                      <td>
                        <span className={`kpi-grade kpi-grade--${g.grade}`}>{g.grade}</span>
                      </td>
                      <td>{g.minPct}% 이상</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <span className="kpi-grade kpi-grade--D">D</span>
                    </td>
                    <td>110% 미만</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <h4>{KPI3_NAME} 결과 등급</h4>
              <table className="team-kpi-table team-kpi-integrated-ref-table">
                <thead>
                  <tr>
                    <th>등급</th>
                    <th>기준</th>
                  </tr>
                </thead>
                <tbody>
                  {KPI3_RESULT_GRADE_TABLE.map((row) => (
                    <tr key={row.grade}>
                      <td>
                        <span className={`kpi-grade kpi-grade--${row.grade}`}>{row.grade}</span>
                      </td>
                      <td>{row.minScore > 0 ? `${row.minScore}점 이상` : '3.5점 미만'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      {variant !== 'report' && (
        <Kpi3HqTargetTable yq={yq} currentComposite={team.kpi3.composite ?? 0} />
      )}

      {children}
    </section>
  );
}
