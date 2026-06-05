import React from 'react';
import { buildDocsModuleUrl } from '../constants/referenceDocs';
import {
  KPI3_HQ_QUARTERLY_TARGETS,
  KPI3_RESULT_GRADE_TABLE,
  getKpi3HqTargetForYq,
  parseYq,
} from '../constants/kpi3HeadquartersGoals';
import './Kpi3HqTargetTable.css';

export default function Kpi3HqTargetTable({ yq, currentComposite }) {
  const { quarter: currentQ } = parseYq(yq);
  const activeHq = getKpi3HqTargetForYq(yq);

  return (
    <div className="kpi3-hq-tables" aria-label="본부 목표 등급 기준">
      <div className="kpi3-hq-tables-head">
        <h4>본부 목표 등급 기준 (팀 KPI · 지표3)</h4>
        <a href={buildDocsModuleUrl('kpi-definition')} target="_blank" rel="noopener noreferrer" className="kpi3-hq-doc-link">
          KPI 정의서 전문
        </a>
      </div>

      {activeHq && (
        <p className="kpi3-hq-current">
          <strong>{yq}</strong> 본부 분기 목표:{' '}
          {activeHq.minScore != null ? (
            <>
              종합 <strong>{activeHq.minScore}점</strong> 이상 · {activeHq.phase}
              {currentComposite > 0 && (
                <span className={currentComposite >= activeHq.minScore ? ' kpi3-hq-met' : ' kpi3-hq-gap'}>
                  {' '}
                  (현재 {currentComposite}점
                  {currentComposite >= activeHq.minScore ? ' · 달성' : ` · ${(activeHq.minScore - currentComposite).toFixed(2)}점 부족`})
                </span>
              )}
            </>
          ) : (
            <>{activeHq.phase} — {activeHq.meaning}</>
          )}
        </p>
      )}

      <div className="kpi3-hq-table-grid">
        <div>
          <h5>분기별 본부 실행 목표</h5>
          <table className="kpi3-hq-table">
            <thead>
              <tr>
                <th>분기</th>
                <th>목표 점수</th>
                <th>단계</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {KPI3_HQ_QUARTERLY_TARGETS.map((row) => (
                <tr
                  key={row.label}
                  className={row.quarter === currentQ ? 'kpi3-hq-table-row--active' : undefined}
                >
                  <td>{row.label}</td>
                  <td>{row.minScore != null ? `${row.minScore}점 이상` : '—'}</td>
                  <td>{row.phase}</td>
                  <td>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h5>결과 평가 등급 (종합 점수)</h5>
          <table className="kpi3-hq-table">
            <thead>
              <tr>
                <th>등급</th>
                <th>기준</th>
                <th>의미</th>
              </tr>
            </thead>
            <tbody>
              {KPI3_RESULT_GRADE_TABLE.map((row) => (
                <tr key={row.grade}>
                  <td>
                    <span className={`kpi-grade kpi-grade--${row.grade}`}>{row.grade}</span>
                  </td>
                  <td>{row.minScore > 0 ? `${row.minScore}점 이상` : '3.5점 미만'}</td>
                  <td>{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
