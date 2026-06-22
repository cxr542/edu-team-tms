import React, { useState } from 'react';
import CompetencyRubricPanel from './CompetencyRubricPanel';
import Kpi3ElementsPanel from './Kpi3ElementsPanel';
import { COMPETENCY_MEMBER_TABS } from '../constants/competencyTabs';
import { KPI3_ELEMENTS } from '../constants/kpi3Elements';
import { formatKpiMemberLabel } from '../constants/kpiMembers';
import { useTeamKpiMetrics } from '../context/JournalProvider';

const KPI3_BY_KEY = Object.fromEntries(KPI3_ELEMENTS.map((el) => [el.key, el]));

/**
 * 구성원 1명 — 헤더 + 4탭(레벨 자체평가 / 다면 / 리더 / 실전)
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
  showManagerTabs = false,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(monthIndex);
  const memberCode = member.code;
  const competencyMonthRec = journal.getCompetencyMonth(year, selectedMonthIndex, memberCode);
  const quarterRec = journal.getQuarterRecord(year, monthIndex, memberCode);
  const kpiMetrics = useTeamKpiMetrics(year, monthIndex, memberCode);
  const readOnly = journal.kpiOperationalReadOnly || !canEditSelf;
  const q = quarterRec.quarter;
  const quarterNumber = Number(quarter || Math.floor(monthIndex / 3) + 1);
  const quarterMonthIndexes = [0, 1, 2].map((offset) => (quarterNumber - 1) * 3 + offset);

  const activeMeta = COMPETENCY_MEMBER_TABS.find((t) => t.id === activeTab) ?? COMPETENCY_MEMBER_TABS[0];
  const monthlyTab = COMPETENCY_MEMBER_TABS.find((tab) => tab.id === 'level') ?? COMPETENCY_MEMBER_TABS[0];
  const quarterlyTabs = COMPETENCY_MEMBER_TABS.filter((tab) =>
    tab.id === 'dm' || tab.id === 'leader' || tab.id === 'practice'
  );

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
        {pageMode && <h2 className="competency-member-block__title">역량 평가 입력</h2>}
        {!canEditSelf && <span className="competency-member-block__badge">조회</span>}
        <dl className="competency-member-block__status">
          <div>
            <dt>{selectedMonthIndex + 1}월 자체</dt>
            <dd className={competencyMonthRec?.selfLocked ? 'is-done' : ''}>
              {competencyMonthRec?.selfLocked ? '확정' : '작성중'}
            </dd>
          </div>
          <div>
            <dt>월 제안</dt>
            <dd>
              {competencyMonthRec?.selfLocked && competencyMonthRec?.self?.computed?.proposed != null
                ? competencyMonthRec.self.computed.proposed
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

      <div className="competency-member-input-layout">
        <aside className="competency-member-input-menu">
          <p className="competency-member-input-menu__eyebrow">입력 메뉴</p>
          <nav
            className="competency-member-mode-nav"
            aria-label={`${formatKpiMemberLabel(member)} 역량 평가 입력 메뉴`}
          >
            <button
              type="button"
              className={`competency-member-mode-tab${activeTab === 'level' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('level')}
              aria-current={activeTab === 'level' ? 'true' : undefined}
            >
              <span>월별 레벨 자체평가</span>
              <small>매월 작성</small>
            </button>
            <button
              type="button"
              className={`competency-member-mode-tab${kpi3Section ? ' is-active' : ''}`}
              onClick={() => setActiveTab(kpi3Section || 'dm')}
              aria-current={kpi3Section ? 'true' : undefined}
            >
              <span>분기 평가 입력</span>
              <small>분기별 작성</small>
            </button>
          </nav>
        </aside>

        <div className="competency-member-block__body competency-member-input-panel">
          <div className="competency-member-input-panel__head">
            <p className="competency-member-input-panel__type">
              {kpi3Section ? '분기 입력' : '월별 입력'}
            </p>
            <h3>{kpi3Section ? '분기 평가 입력' : `${year}년 ${selectedMonthIndex + 1}월 ${monthlyTab.label}`}</h3>
            <p className="team-kpi-hint competency-member-tab-hint">{activeMeta.hint}</p>
            {!kpi3Section && (
              <div className="competency-month-selector" aria-label="월별 레벨 자체평가 월 선택">
                {quarterMonthIndexes.map((mIdx) => (
                  <button
                    key={mIdx}
                    type="button"
                    className={`competency-month-selector__btn${selectedMonthIndex === mIdx ? ' is-active' : ''}`}
                    onClick={() => setSelectedMonthIndex(mIdx)}
                    aria-current={selectedMonthIndex === mIdx ? 'true' : undefined}
                  >
                    {mIdx + 1}월
                  </button>
                ))}
              </div>
            )}
          </div>

          {kpi3Section && (
            <nav
              className="competency-member-tabs competency-member-tabs--quarterly"
              aria-label={`${formatKpiMemberLabel(member)} 분기 평가 항목`}
            >
              {quarterlyTabs.map((tab) => (
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
          )}

        {activeTab === 'level' && (
          <div className="competency-member-tab-panel" role="tabpanel">
            <CompetencyRubricPanel
              side="self"
              record={competencyMonthRec}
              memberRole={member.role}
              readOnly={readOnly}
              memberView
              onUpdate={(patch) => journal.updateCompetencySelf(year, selectedMonthIndex, memberCode, patch)}
              onLock={() => {
                const r = journal.lockCompetencyMonth(year, selectedMonthIndex, memberCode, { side: 'self' });
                if (r.ok) {
                  onToast?.(`${member.displayName} · ${year}-${String(selectedMonthIndex + 1).padStart(2, '0')} 레벨 자체평가 제출`);
                } else if (r.reason === 'invalid-int-level') {
                  onToast?.('정수 레벨을 1~5 중에서 선택해 주세요');
                }
              }}
              onUnlockSelf={() => {
                const r = journal.unlockCompetencyMonthSelf?.(year, selectedMonthIndex, memberCode);
                if (r?.ok) {
                  onToast?.(`${member.displayName} · ${year}-${String(selectedMonthIndex + 1).padStart(2, '0')} 제출 취소`);
                } else if (r?.reason === 'manager-locked') {
                  onToast?.('팀장 검토가 완료되어 수정할 수 없습니다');
                } else if (r?.reason === 'read-only') {
                  onToast?.('조회 모드에서는 수정할 수 없습니다');
                }
              }}
              onUnlockManager={() => {
                const r = journal.unlockCompetencyMonthManager?.(year, selectedMonthIndex, memberCode);
                if (r?.ok) {
                  onToast?.(`${member.displayName} · ${year}-${String(selectedMonthIndex + 1).padStart(2, '0')} 팀장 확정 해제`);
                } else if (r?.reason === 'read-only') {
                  onToast?.('조회 모드에서는 수정할 수 없습니다');
                }
              }}
            />
          </div>
        )}

        {kpi3Section && kpi3El && (
          <div className="competency-member-tab-panel" role="tabpanel">
            <p className="competency-member-tab-panel__meta">
              분기 {yq} · {kpi3El.label}
            </p>
            <Kpi3ElementsPanel
              year={year}
              month={monthIndex}
              memberCode={memberCode}
              yq={yq}
              quarterRec={quarterRec}
              journal={journal}
              showManagerTabs={showManagerTabs}
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
      </div>
    </article>
  );
}
