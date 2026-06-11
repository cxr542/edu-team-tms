import React, { useMemo, useState } from 'react';
import CompetencyRubricPanel from './CompetencyRubricPanel';
import Kpi3ElementsPanel from './Kpi3ElementsPanel';
import { COMPETENCY_MEMBER_TABS } from '../constants/competencyTabs';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { KPI3_ELEMENTS } from '../constants/kpi3Elements';
import { quarterMonthKeysFromYq } from '../constants/kpiOperationalStore';
import { formatKpiMemberLabel } from '../constants/kpiMembers';
import { useTeamKpiMetrics } from '../context/JournalProvider';
import { monthlyFinalScore, quarterMonthKeys } from '../utils/competencyScore';

const KPI3_BY_KEY = Object.fromEntries(KPI3_ELEMENTS.map((el) => [el.key, el]));

/**
 * 구성원 1명 — 헤더 + 4탭(레벨·자체평가 / 다면 / 리더 / 실전)
 */
export default function CompetencyMemberSection({
  member,
  year,
  quarter,
  yq,
  monthIndex,
  journal,
  canEditSelf,
  onToast,
  defaultTab = 'level',
  pageMode = false,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const memberCode = member.code;
  const competencyRec = journal.getCompetencyQuarter(yq, memberCode);
  const quarterRec = journal.getQuarterRecord(year, monthIndex, memberCode);
  const kpiMetrics = useTeamKpiMetrics(year, monthIndex, memberCode);
  const readOnly = journal.kpiOperationalReadOnly || !canEditSelf;
  const q = quarterRec.quarter;

  const monthlyFinalRef = useMemo(() => {
    const yms = quarterMonthKeys(year, monthIndex);
    return yms.map((key) => {
      const mIdx = parseInt(key.split('-')[1], 10) - 1;
      const rec = journal.getCompetencyMonth(year, mIdx, memberCode);
      const final = monthlyFinalScore(
        rec?.self?.computed?.proposed,
        rec?.manager?.computed?.proposed,
        COMPETENCY_USE_4060
      );
      return { ym: key, final, managerLocked: rec?.managerLocked };
    });
  }, [journal, year, monthIndex, memberCode]);

  const activeMeta = COMPETENCY_MEMBER_TABS.find((t) => t.id === activeTab) ?? COMPETENCY_MEMBER_TABS[0];

  const kpi3Section = activeTab === 'dm' || activeTab === 'leader' || activeTab === 'practice' ? activeTab : null;
  const kpi3El = kpi3Section ? KPI3_BY_KEY[kpi3Section] : null;

  return (
    <article
      className={`competency-member-block${
        pageMode ? ' competency-member-block--page' : ''
      }${canEditSelf ? ' competency-member-block--editable' : ' competency-member-block--readonly'}`}
      id={`competency-member-${memberCode}`}
    >
      <header className="competency-member-block__head">
        {!pageMode && (
          <h3 className="competency-member-block__title">{formatKpiMemberLabel(member)}</h3>
        )}
        {pageMode && <h2 className="competency-member-block__title">4가지 평가</h2>}
        {!canEditSelf && <span className="competency-member-block__badge">조회</span>}
        <dl className="competency-member-block__status">
          <div>
            <dt>{quarter}분기 자체</dt>
            <dd className={competencyRec?.selfLocked ? 'is-done' : ''}>
              {competencyRec?.selfLocked ? '확정' : '작성중'}
            </dd>
          </div>
          <div>
            <dt>분기 제안</dt>
            <dd>
              {competencyRec?.selfLocked && competencyRec?.self?.computed?.proposed != null
                ? competencyRec.self.computed.proposed
                : '—'}
            </dd>
          </div>
          <div>
            <dt>다면</dt>
            <dd>{q.dm > 0 ? q.dm : '—'}</dd>
          </div>
          <div>
            <dt>리더</dt>
            <dd>{q.leader > 0 ? q.leader : '—'}</dd>
          </div>
          <div>
            <dt>실전</dt>
            <dd>{q.practice > 0 ? q.practice : '—'}</dd>
          </div>
        </dl>
      </header>

      <nav
        className="competency-member-tabs"
        aria-label={`${formatKpiMemberLabel(member)} 평가 항목`}
      >
        {COMPETENCY_MEMBER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`competency-member-tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'true' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="competency-member-block__body">
        <p className="team-kpi-hint competency-member-tab-hint">{activeMeta.hint}</p>

        {activeTab === 'level' && (
          <div className="competency-member-tab-panel" role="tabpanel">
            <CompetencyRubricPanel
              side="self"
              record={competencyRec}
              readOnly={readOnly}
              memberView
              onUpdate={(patch) => journal.updateCompetencyQuarterSelf(yq, memberCode, patch)}
              onLock={() => {
                const r = journal.lockCompetencyQuarter(yq, memberCode, { side: 'self' });
                if (r.ok) {
                  onToast?.(`${member.displayName} · ${yq} 분기 자체평가 확정`);
                } else if (r.reason === 'invalid-int-level') {
                  onToast?.('정수 레벨을 1~5 중에서 선택해 주세요');
                }
              }}
            />
            <div className="competency-quarter-level-ref">
              <h4 className="competency-quarter-level-ref__title">이전 월별 평가(참고) · 분기 {yq}</h4>
              <ul className="team-kpi-memo-list">
                {quarterMonthKeysFromYq(yq).map((key) => {
                  const mIdx = parseInt(key.split('-')[1], 10) - 1;
                  const ref = monthlyFinalRef.find((x) => x.ym === key);
                  return (
                    <li key={key}>
                      {key}: 월간 {ref?.final ?? '—'}
                      {ref?.managerLocked ? ' (팀장 확정)' : ''}
                      {' · '}
                      자체{' '}
                      {journal.getCompetencyMonth(year, mIdx, memberCode)?.selfLocked ? '확정' : '작성중'}
                    </li>
                  );
                })}
              </ul>
              <p className="team-kpi-hint">
                KPI3 분기 레벨: <strong>{q.level > 0 ? q.level : '—'}</strong>
                {q.levelAuto ? ' (월간 평균 자동 반영)' : ''}
              </p>
            </div>
          </div>
        )}

        {kpi3Section && kpi3El && (
          <div className="competency-member-tab-panel" role="tabpanel">
            <p className="competency-member-tab-panel__meta">
              분기 {yq} · {kpi3El.label} ({kpi3El.weightPct}%)
            </p>
            <Kpi3ElementsPanel
              year={year}
              month={monthIndex}
              memberCode={memberCode}
              yq={yq}
              quarterRec={quarterRec}
              journal={journal}
              showManagerTabs={false}
              allowMemberDmEdit={canEditSelf}
              showCoaching={false}
              section={kpi3Section}
              compact
              canEdit={canEditSelf}
              kpiMetrics={kpiMetrics}
              onToast={onToast}
            />
          </div>
        )}
      </div>
    </article>
  );
}
