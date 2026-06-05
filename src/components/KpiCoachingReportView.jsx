import React from 'react';
import './Kpi3CoachingReport.css';

function BulletList({ items, emptyText }) {
  if (!items?.length) {
    return <p className="kpi3-coaching-empty">{emptyText}</p>;
  }
  return (
    <ul className="kpi3-coaching-list">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`}>
          <span className="kpi3-coaching-score">{item.score}</span>
          {item.text}
        </li>
      ))}
    </ul>
  );
}

function RecommendationList({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="kpi3-coaching-recs">
      {items.map((rec, i) => (
        <li key={`${rec.type}-${i}`} className={`kpi3-coaching-rec kpi3-coaching-rec--${rec.type}`}>
          {rec.text.split('**').map((part, j) =>
            j % 2 === 1 ? (
              <strong key={j}>{part}</strong>
            ) : (
              <span key={j}>{part}</span>
            )
          )}
        </li>
      ))}
    </ul>
  );
}

function RichText({ text }) {
  if (!text) return null;
  return text.split('**').map((part, j) =>
    j % 2 === 1 ? (
      <strong key={j}>{part}</strong>
    ) : (
      <span key={j}>{part}</span>
    )
  );
}

/** @param {{ report: object, title?: string, ariaLabel?: string, showHeadlineSummary?: boolean }} props */
export default function KpiCoachingReportView({
  report,
  title = '평가 분석 · 본부 목표 달성 제안',
  ariaLabel = 'KPI 평가 분석',
  showHeadlineSummary = true,
}) {
  if (!report?.ready) {
    return (
      <aside className="kpi3-coaching" aria-label={ariaLabel}>
        <p className="kpi3-coaching-placeholder">
          {report?.headline || '지표가 입력되면 강점·보완·본부 목표 달성 제안을 표시합니다.'}
        </p>
      </aside>
    );
  }

  return (
    <aside className="kpi3-coaching" aria-label={ariaLabel}>
      <h3 className="kpi3-coaching-title">{title}</h3>

      {showHeadlineSummary && report.headline && (
        <p className="kpi3-coaching-summary">
          <RichText text={report.headline} />
        </p>
      )}

      <div className="kpi3-coaching-columns">
        <section className="kpi3-coaching-block kpi3-coaching-block--good">
          <h4>잘한 부분</h4>
          <BulletList
            items={report.strengths}
            emptyText="특정 강점이 두드러지지 않습니다. KPI1·2·3를 고르게 올리는 것이 유리합니다."
          />
        </section>
        <section className="kpi3-coaching-block kpi3-coaching-block--gap">
          <h4>미흡한 부분</h4>
          <BulletList
            items={report.weaknesses}
            emptyText="치명적으로 낮은 지표는 없습니다. 본부 분기 목표 대비 낮은 축·구성원을 우선 보완하세요."
          />
        </section>
      </div>

      <section className="kpi3-coaching-block kpi3-coaching-block--next">
        <h4>본부 목표 등급 달성을 위한 제안</h4>
        <RecommendationList
          items={(report.recommendations || []).filter((r) => r.type !== 'headline')}
        />
      </section>
    </aside>
  );
}
