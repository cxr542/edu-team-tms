import React from 'react';
import { KPI1_NAME, KPI2_NAME, KPI3_NAME } from '../constants/kpiDisplayNames';
import { KPI3_ELEMENTS } from '../constants/kpi3Elements';
import { formatScoreTenth } from '../utils/kpiGrades';
import Kpi3PartialNote from './Kpi3PartialNote';
import TeamKpiCoachingReport from './TeamKpiCoachingReport';

function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

function Grade({ value }) {
  return <span className={`kpi-grade kpi-grade--${value}`}>{value}</span>;
}

function Kpi2Cell({ pct, usesPreview }) {
  return (
    <>
      {formatPct(pct)}
      {usesPreview ? ' *' : ''}
    </>
  );
}

function SummaryCards({ team, kpi3, kpi3Label }) {
  return (
    <div className="kpi-report-period-cards">
      <div className="kpi-report-period-card">
        <span className="kpi-report-period-card__label">{KPI1_NAME}</span>
        <strong>{formatPct(team.kpi1.utilization)}</strong>
        <span>
          팀 등급 <Grade value={team.grade1} />
        </span>
        <small>업무 {team.kpi1.work.toFixed(2)} · 생산향상 {team.kpi1.improve.toFixed(2)} · 휴일 {team.kpi1.leave.toFixed(2)} / 가용 {team.kpi1.available.toFixed(2)} M/D</small>
      </div>
      <div className="kpi-report-period-card">
        <span className="kpi-report-period-card__label">{KPI2_NAME}</span>
        <strong>
          <Kpi2Cell pct={team.kpi2.displayPct} usesPreview={team.kpi2.usesPreview} />
        </strong>
        <span>
          팀 등급 <Grade value={team.grade2} />
        </span>
        <small>
          계획 {Number(team.kpi2.planSum || 0).toFixed(2)}h / 실적 {Number(team.kpi2.actualSum || 0).toFixed(2)}h · 승인 효과 {team.kpi2.submittedCount ?? 0}건
        </small>
      </div>
      <div className="kpi-report-period-card">
        <span className="kpi-report-period-card__label">{kpi3Label || KPI3_NAME}</span>
        <strong>{kpi3.composite != null && kpi3.composite > 0 ? formatScoreTenth(kpi3.composite) : '—'}</strong>
        <span>
          팀 등급 <Grade value={kpi3.grade3} />
        </span>
        <small>{kpi3.note}</small>
      </div>
    </div>
  );
}

function MemberKpiTable({ memberRows, team, title }) {
  return (
    <section className="kpi-report-block">
      <h2 className="kpi-report-member-title">{title}</h2>
      <table className="team-kpi-table">
        <thead>
          <tr>
            <th>구성원</th>
            <th>{KPI1_NAME}</th>
            <th>등급</th>
            <th>{KPI2_NAME}</th>
            <th>등급</th>
            <th>효과 건</th>
          </tr>
        </thead>
        <tbody>
          {memberRows.map((row) => (
            <tr key={row.member.code}>
              <td>
                {row.member.displayName} ({row.member.code})
              </td>
              <td>{formatPct(row.kpi1.utilization)}</td>
              <td>
                <Grade value={row.grade1} />
              </td>
              <td>
                <Kpi2Cell pct={row.kpi2DisplayPct} usesPreview={row.kpi2UsesPreview} />
              </td>
              <td>
                <Grade value={row.grade2} />
              </td>
              <td>{row.kpi2.effectCount}</td>
            </tr>
          ))}
          <tr className="kpi-report-team-row">
            <td>
              <strong>팀 통합</strong>
            </td>
            <td>{formatPct(team.kpi1.utilization)}</td>
            <td>
              <Grade value={team.grade1} />
            </td>
            <td>
              <Kpi2Cell pct={team.kpi2.displayPct} usesPreview={team.kpi2.usesPreview} />
            </td>
            <td>
              <Grade value={team.grade2} />
            </td>
            <td>{team.kpi2.submittedCount ?? 0}</td>
          </tr>
        </tbody>
      </table>
      <p className="team-kpi-hint">
        월 값을 평균하지 않고 기간 전체의 분자·분모를 합산해 계산합니다 · {KPI1_NAME}: Σ(업무+생산향상+휴일 M/D) ÷ Σ가용 M/D · {KPI2_NAME}: Σ계획시간 ÷ Σ실작업시간 (* = 승인 전 포함)
      </p>
    </section>
  );
}

function mdText(n) {
  return n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toFixed(2);
}

/** 월간 리포트 1 — 구성원별 업무 리소스 가동률 */
export function MonthlyUtilizationTable({ monthly, team, ym }) {
  return (
    <section className="kpi-report-block">
      <h2 className="kpi-report-member-title">
        ① 구성원별 · {KPI1_NAME} · {ym}
      </h2>
      <table className="team-kpi-table">
        <thead>
          <tr>
            <th>구성원</th>
            <th>업무 M/D</th>
            <th>생산향상 M/D</th>
            <th>휴일 M/D</th>
            <th>가용 M/D</th>
            <th>{KPI1_NAME}</th>
            <th>등급</th>
            <th>월 마감</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((row) => (
            <tr key={row.member.code}>
              <td>
                {row.member.displayName} ({row.member.code})
              </td>
              <td>{mdText(row.kpi1.work)}</td>
              <td>{mdText(row.kpi1.improve)}</td>
              <td>{mdText(row.kpi1.leave)}</td>
              <td>{mdText(row.kpi1.available)}</td>
              <td>
                <strong>{formatPct(row.kpi1.utilization)}</strong>
              </td>
              <td>
                <Grade value={row.grade1} />
              </td>
              <td>{row.status}</td>
            </tr>
          ))}
          <tr className="kpi-report-team-row">
            <td>
              <strong>팀 평균</strong>
            </td>
            <td>{mdText(team.kpi1.work)}</td>
            <td>{mdText(team.kpi1.improve)}</td>
            <td>{mdText(team.kpi1.leave)}</td>
            <td>{mdText(team.kpi1.available)}</td>
            <td>
              <strong>{formatPct(team.kpi1.utilization)}</strong>
            </td>
            <td>
              <Grade value={team.grade1} />
            </td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
      <p className="team-kpi-hint">
        {KPI1_NAME} = (업무+생산향상+휴일 M/D) ÷ 가용 M/D × 100 · 팀 평균은 구성원 M/D 합계로 계산한 팀 값입니다.
      </p>
    </section>
  );
}

/** 월간 리포트 2 — 구성원별 업무 리소스 생산성 */
export function MonthlyProductivityTable({ monthly, team, ym }) {
  const sums = (row) => (row.kpi2UsesPreview ? row.kpi2Preview : row.kpi2) || {};
  const teamSums = team.kpi2.usesPreview ? team.kpi2.preview : team.kpi2;
  return (
    <section className="kpi-report-block">
      <h2 className="kpi-report-member-title">
        ② 구성원별 · {KPI2_NAME} · {ym}
      </h2>
      <table className="team-kpi-table">
        <thead>
          <tr>
            <th>구성원</th>
            <th>효과 건</th>
            <th>승인 건</th>
            <th>계획시간(h)</th>
            <th>실작업시간(h)</th>
            <th>{KPI2_NAME}</th>
            <th>등급</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((row) => (
            <tr key={row.member.code}>
              <td>
                {row.member.displayName} ({row.member.code})
              </td>
              <td>{row.kpi2.effectCount}</td>
              <td>{row.kpi2.submittedCount ?? 0}</td>
              <td>{mdText(sums(row).planSum)}</td>
              <td>{mdText(sums(row).actualSum)}</td>
              <td>
                <strong>
                  <Kpi2Cell pct={row.kpi2DisplayPct} usesPreview={row.kpi2UsesPreview} />
                </strong>
              </td>
              <td>
                <Grade value={row.grade2} />
              </td>
            </tr>
          ))}
          <tr className="kpi-report-team-row">
            <td>
              <strong>팀 평균</strong>
            </td>
            <td>{team.kpi2.effectCount ?? 0}</td>
            <td>{team.kpi2.submittedCount ?? 0}</td>
            <td>{mdText(teamSums?.planSum)}</td>
            <td>{mdText(teamSums?.actualSum)}</td>
            <td>
              <strong>
                <Kpi2Cell pct={team.kpi2.displayPct} usesPreview={team.kpi2.usesPreview} />
              </strong>
            </td>
            <td>
              <Grade value={team.grade2} />
            </td>
          </tr>
        </tbody>
      </table>
      <p className="team-kpi-hint">
        {KPI2_NAME} = 계획시간 합 ÷ 실작업시간 합 × 100 (승인 효과 건 기준, * = 승인 전 포함) · 팀 평균은 시간 합계로 계산한 팀 값입니다.
      </p>
    </section>
  );
}

function levelText(v) {
  return v == null ? '—' : formatScoreTenth(v);
}

function competencyStatus(row) {
  if (row.managerLocked) return '팀장 확정';
  if (row.selfLocked) return '자체평가 제출';
  if (row.selfLevel != null) return '작성중';
  return '미작성';
}

/** 월간 리포트 — 상단 요약 카드 (분기 역량 카드 대신 월별 레벨 평가) */
export function MonthlyCompetencyCard({ report }) {
  const total = report.rows.length;
  return (
    <article className="team-kpi-integrated-card kpi3">
      <h3>월별 레벨 평가 · {report.ym}</h3>
      <p className="team-kpi-integrated-big">{levelText(report.teamAverage)}</p>
      <p className="team-kpi-integrated-meta">팀 평균 월 최종 레벨</p>
      <ul className="team-kpi-integrated-kpi3">
        <li>
          자체평가 제출 {report.submittedCount}/{total}
        </li>
        <li>
          팀장 확정 {report.confirmedCount}/{total}
        </li>
      </ul>
      <p className="team-kpi-integrated-formula">
        월 최종 = 구성원 자체평가·팀장 평가의 결합 점수 · 분기 평가(다면·리더·실전)는 분기 리포트에서 확인
      </p>
    </article>
  );
}

/** 월간 리포트 — 구성원별 월별 레벨 평가 */
export function MonthlyCompetencyTable({ report }) {
  return (
    <section className="kpi-report-block">
      <h2 className="kpi-report-member-title">③ 구성원별 · 월별 레벨 평가 · {report.ym}</h2>
      <table className="team-kpi-table">
        <thead>
          <tr>
            <th>구성원</th>
            <th>자체평가 레벨</th>
            <th>자체평가 점수</th>
            <th>팀장 평가 레벨</th>
            <th>팀장 평가 점수</th>
            <th>월 최종</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.member.code}>
              <td>
                {row.member.displayName} ({row.member.code})
              </td>
              <td>{row.selfLevel ?? '—'}</td>
              <td>{levelText(row.selfProposed > 0 ? row.selfProposed : null)}</td>
              <td>{row.managerLevel ?? '—'}</td>
              <td>{levelText(row.mgrProposed > 0 ? row.mgrProposed : null)}</td>
              <td>
                <strong>{levelText(row.monthlyFinal)}</strong>
              </td>
              <td>{competencyStatus(row)}</td>
            </tr>
          ))}
          <tr className="kpi-report-team-row">
            <td>
              <strong>팀 평균</strong>
            </td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>
              <strong>{levelText(report.teamAverage)}</strong>
            </td>
            <td>
              확정 {report.confirmedCount}/{report.rows.length}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="team-kpi-hint">
        월별 레벨 자체평가는 매월 진행합니다. 다면·리더·실전 분기 평가는 분기 리포트에서 확인하세요.
      </p>
    </section>
  );
}

/** 분기 리포트 — 월별 값을 곁들인 구성원별 합산 표 (kind: 'kpi1' | 'kpi2') */
function PeriodTrendMemberTable({ kind, columns, memberRows, team, title, hint, totalLabel }) {
  const isKpi1 = kind === 'kpi1';
  const name = isKpi1 ? KPI1_NAME : KPI2_NAME;
  const monthValue = (m, code) => {
    const row = m.rows.find((r) => r.member.code === code);
    if (!row) return '—';
    return isKpi1 ? formatPct(row.kpi1.utilization) : (
      <Kpi2Cell pct={row.kpi2DisplayPct} usesPreview={row.kpi2UsesPreview} />
    );
  };
  const sums = (row) => (row.kpi2UsesPreview ? row.kpi2Preview : row.kpi2) || {};
  const teamSums = team.kpi2.usesPreview ? team.kpi2.preview : team.kpi2;
  return (
    <section className="kpi-report-block">
      <h2 className="kpi-report-member-title">{title}</h2>
      <table className="team-kpi-table">
        <thead>
          <tr>
            <th>구성원</th>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {isKpi1 ? (
              <>
                <th>업무 M/D</th>
                <th>생산향상 M/D</th>
                <th>휴일 M/D</th>
                <th>가용 M/D</th>
              </>
            ) : (
              <>
                <th>효과 건</th>
                <th>계획시간(h)</th>
                <th>실작업시간(h)</th>
              </>
            )}
            <th>{totalLabel} {name}</th>
            <th>등급</th>
          </tr>
        </thead>
        <tbody>
          {memberRows.map((row) => (
            <tr key={row.member.code}>
              <td>
                {row.member.displayName} ({row.member.code})
              </td>
              {columns.map((c) => (
                <td key={c.key}>{monthValue(c, row.member.code)}</td>
              ))}
              {isKpi1 ? (
                <>
                  <td>{mdText(row.kpi1.work)}</td>
                  <td>{mdText(row.kpi1.improve)}</td>
                  <td>{mdText(row.kpi1.leave)}</td>
                  <td>{mdText(row.kpi1.available)}</td>
                </>
              ) : (
                <>
                  <td>{row.kpi2.effectCount}</td>
                  <td>{mdText(sums(row).planSum)}</td>
                  <td>{mdText(sums(row).actualSum)}</td>
                </>
              )}
              <td>
                <strong>
                  {isKpi1 ? (
                    formatPct(row.kpi1.utilization)
                  ) : (
                    <Kpi2Cell pct={row.kpi2DisplayPct} usesPreview={row.kpi2UsesPreview} />
                  )}
                </strong>
              </td>
              <td>
                <Grade value={isKpi1 ? row.grade1 : row.grade2} />
              </td>
            </tr>
          ))}
          <tr className="kpi-report-team-row">
            <td>
              <strong>팀 평균</strong>
            </td>
            {columns.map((c) => (
              <td key={c.key}>
                {isKpi1 ? (
                  formatPct(c.team.kpi1.utilization)
                ) : (
                  <Kpi2Cell pct={c.team.kpi2.displayPct} usesPreview={c.team.kpi2.usesPreview} />
                )}
              </td>
            ))}
            {isKpi1 ? (
              <>
                <td>{mdText(team.kpi1.work)}</td>
                <td>{mdText(team.kpi1.improve)}</td>
                <td>{mdText(team.kpi1.leave)}</td>
                <td>{mdText(team.kpi1.available)}</td>
              </>
            ) : (
              <>
                <td>{team.kpi2.effectCount ?? 0}</td>
                <td>{mdText(teamSums?.planSum)}</td>
                <td>{mdText(teamSums?.actualSum)}</td>
              </>
            )}
            <td>
              <strong>
                {isKpi1 ? (
                  formatPct(team.kpi1.utilization)
                ) : (
                  <Kpi2Cell pct={team.kpi2.displayPct} usesPreview={team.kpi2.usesPreview} />
                )}
              </strong>
            </td>
            <td>
              <Grade value={isKpi1 ? team.grade1 : team.grade2} />
            </td>
          </tr>
        </tbody>
      </table>
      <p className="team-kpi-hint">{hint}</p>
    </section>
  );
}

/** 분기 보기 */
export function KpiReportQuarterView({ view, year, quarter }) {
  const { memberRows, quarterly, team, competencyMonths, months } = view;
  const yq = `${year}-${quarter}Q`;
  const monthColumns = months.map((m) => ({ key: m.monthIndex, label: `${m.monthIndex + 1}월`, rows: m.rows, team: m.team }));
  return (
    <>
      <SummaryCards
        team={team}
        kpi3={{
          composite: team.kpi3.composite,
          grade3: team.grade3,
          note: `${yq} · 4요소 구성원 평균 후 가중 합산`,
        }}
      />

      <PeriodTrendMemberTable
        kind="kpi1"
        columns={monthColumns}
        memberRows={memberRows}
        team={team}
        totalLabel="분기"
        title={`① 구성원별 · ${KPI1_NAME} · ${yq}`}
        hint={`${KPI1_NAME} = Σ(업무+생산향상+휴일 M/D) ÷ Σ가용 M/D × 100 · 월 값을 평균하지 않고 분기 합계로 계산합니다. 팀 평균은 합계로 계산한 팀 값입니다.`}
      />

      <PeriodTrendMemberTable
        kind="kpi2"
        columns={monthColumns}
        memberRows={memberRows}
        team={team}
        totalLabel="분기"
        title={`② 구성원별 · ${KPI2_NAME} · ${yq}`}
        hint={`${KPI2_NAME} = Σ계획시간 ÷ Σ실작업시간 × 100 (승인 효과 건 기준, * = 승인 전 포함) · 팀 평균은 시간 합계로 계산한 팀 값입니다.`}
      />

      <section className="kpi-report-block">
        <h2 className="kpi-report-member-title">
          ③ 구성원별 · 분기 평가({KPI3_NAME}) · {yq}
        </h2>
        <table className="team-kpi-table">
          <thead>
            <tr>
              <th>구성원</th>
              {KPI3_ELEMENTS.map((el) => (
                <th key={el.key}>
                  {el.label}
                  <span className="team-kpi-th-weight"> ({el.weightPct}%)</span>
                </th>
              ))}
              <th>종합</th>
              <th>등급</th>
              <th>확정</th>
            </tr>
          </thead>
          <tbody>
            {quarterly.map((row) => (
              <tr key={row.member.code}>
                <td>
                  {row.member.displayName} ({row.member.code})
                </td>
                {KPI3_ELEMENTS.map((el) =>
                  el.key === 'level' ? (
                    <td key={el.key}>
                      <div className="kpi-report-level-months">
                        {competencyMonths.map((m) => {
                          const r = m.rows.find((x) => x.member.code === row.member.code);
                          return (
                            <span key={m.ym}>
                              {m.monthIndex + 1}월 {levelText(r?.monthlyFinal)}
                              {r?.monthlyFinal != null && !r.managerLocked ? '(미확정)' : ''}
                            </span>
                          );
                        })}
                      </div>
                      <strong>
                        {row.breakdown?.level > 0 ? row.breakdown.level : '—'}
                        {row.breakdown?.levelAuto ? ' *' : ''}
                      </strong>
                    </td>
                  ) : (
                    <td key={el.key}>{row.breakdown?.[el.key] > 0 ? row.breakdown[el.key] : '—'}</td>
                  )
                )}
                <td>
                  {row.quarter.composite > 0 ? formatScoreTenth(row.quarter.composite) : '—'}
                  <Kpi3PartialNote source={row.breakdown} />
                </td>
                <td>
                  <Grade value={row.grade3} />
                </td>
                <td>{row.locked ? '확정' : '작성중'}</td>
              </tr>
            ))}
            <tr className="kpi-report-team-row">
              <td>
                <strong>팀 평균</strong>
              </td>
              {KPI3_ELEMENTS.map((el) =>
                el.key === 'level' ? (
                  <td key={el.key}>
                    <div className="kpi-report-level-months">
                      {competencyMonths.map((m) => (
                        <span key={m.ym}>
                          {m.monthIndex + 1}월 {levelText(m.teamAverage)}
                        </span>
                      ))}
                    </div>
                    <strong>{team.kpi3.level > 0 ? team.kpi3.level : '—'}</strong>
                  </td>
                ) : (
                  <td key={el.key}>{team.kpi3[el.key] > 0 ? team.kpi3[el.key] : '—'}</td>
                )
              )}
              <td>
                {team.kpi3.composite > 0 ? formatScoreTenth(team.kpi3.composite) : '—'}
                <Kpi3PartialNote source={team.kpi3} />
              </td>
              <td>
                <Grade value={team.grade3} />
              </td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
        <p className="team-kpi-hint">
          팀 {KPI3_NAME}: {team.kpi3.formula} · 레벨은 월별 레벨 평가(월 최종)를 매월 진행하고, 분기 마지막 달(2분기=6월, 3분기=9월)의 팀장 확정 레벨이 분기 레벨로 반영됩니다 (* = 자동 반영). 다면·리더·실전은 분기에 한 번 평가합니다.
        </p>
      </section>

      <TeamKpiCoachingReport team={team} monthly={memberRows} quarterly={quarterly} yq={yq} />
    </>
  );
}

/** 연간 보기 */
export function KpiReportAnnualView({ view, year }) {
  const { memberRows, team, quarters, memberKpi3, teamKpi3, quarterRows } = view;
  const confirmedQuarters = quarters.filter((q) => q.confirmedCount > 0).length;
  const quarterColumns = quarterRows.map((q) => ({
    key: q.quarter,
    label: `${q.quarter}Q`,
    rows: q.memberRows,
    team: q.team,
  }));
  return (
    <>
      <SummaryCards
        team={team}
        kpi3={{
          composite: teamKpi3.composite,
          grade3: teamKpi3.grade3,
          note: `4분기 종합 반영 · 4Q 확정 ${teamKpi3.memberCount}명 · 확정 분기 ${confirmedQuarters}/4`,
        }}
        kpi3Label={`${KPI3_NAME} (연간)`}
      />

      <PeriodTrendMemberTable
        kind="kpi1"
        columns={quarterColumns}
        memberRows={memberRows}
        team={team}
        totalLabel="연간"
        title={`① 구성원별 · ${KPI1_NAME} · ${year}년`}
        hint={`${KPI1_NAME} = Σ(업무+생산향상+휴일 M/D) ÷ Σ가용 M/D × 100 · 분기·연간 값은 월 값을 평균하지 않고 합계로 계산합니다. 팀 평균은 합계로 계산한 팀 값입니다.`}
      />

      <PeriodTrendMemberTable
        kind="kpi2"
        columns={quarterColumns}
        memberRows={memberRows}
        team={team}
        totalLabel="연간"
        title={`② 구성원별 · ${KPI2_NAME} · ${year}년`}
        hint={`${KPI2_NAME} = Σ계획시간 ÷ Σ실작업시간 × 100 (승인 효과 건 기준, * = 승인 전 포함) · 팀 평균은 시간 합계로 계산한 팀 값입니다.`}
      />

      <section className="kpi-report-block">
        <h2 className="kpi-report-member-title">
          ③ 구성원별 · 분기 평가({KPI3_NAME}) · {year}년
        </h2>
        <table className="team-kpi-table">
          <thead>
            <tr>
              <th>구성원</th>
              {[1, 2, 3, 4].map((q) => (
                <th key={q}>{q}Q 종합 (레벨)</th>
              ))}
              <th>연간 (4Q 종합 · 레벨)</th>
              <th>등급</th>
              <th>확정 분기</th>
            </tr>
          </thead>
          <tbody>
            {memberKpi3.map((row) => (
              <tr key={row.member.code}>
                <td>
                  {row.member.displayName} ({row.member.code})
                </td>
                {row.perQuarter.map((p) => (
                  <td key={p.quarter}>
                    {p.composite != null ? formatScoreTenth(p.composite) : '—'}
                    {p.composite != null && !p.locked ? ' (작성중)' : ''}
                    <div className="kpi-report-level-months">
                      <span>레벨 {p.level != null ? p.level : '—'}</span>
                    </div>
                  </td>
                ))}
                <td>
                  <strong>{row.annualComposite != null ? formatScoreTenth(row.annualComposite) : '—'}</strong>
                  <div className="kpi-report-level-months">
                    <span>레벨 {row.annualLevel != null ? row.annualLevel : '—'}</span>
                  </div>
                </td>
                <td>
                  <Grade value={row.grade3} />
                </td>
                <td>{row.confirmedCount}/4</td>
              </tr>
            ))}
            <tr className="kpi-report-team-row">
              <td>
                <strong>팀 평균</strong>
              </td>
              {quarters.map((q) => (
                <td key={q.quarter}>
                  {q.composite > 0 ? formatScoreTenth(q.composite) : '—'}
                  {q.composite > 0 ? ` (확정 ${q.confirmedCount}명)` : ''}
                  <div className="kpi-report-level-months">
                    <span>레벨 {q.teamLevel != null ? q.teamLevel : '—'}</span>
                  </div>
                </td>
              ))}
              <td>
                <strong>{teamKpi3.composite != null ? formatScoreTenth(teamKpi3.composite) : '—'}</strong>
                <div className="kpi-report-level-months">
                  <span>레벨 {quarters[3]?.teamLevel != null && teamKpi3.composite != null ? quarters[3].teamLevel : '—'}</span>
                </div>
              </td>
              <td>
                <Grade value={teamKpi3.grade3} />
              </td>
              <td>{confirmedQuarters}/4</td>
            </tr>
          </tbody>
        </table>
        <p className="team-kpi-hint">
          연간 {KPI3_NAME} = 4분기(연말)의 확정 종합 점수와 레벨입니다. 평균하지 않으며 4분기가 확정되기 전에는 비어 있습니다. 분기 레벨은 분기 마지막 달의 팀장 확정 레벨입니다.
        </p>
      </section>
    </>
  );
}
