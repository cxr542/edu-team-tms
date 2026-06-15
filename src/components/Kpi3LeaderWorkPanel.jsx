import React, { useState } from 'react';
import CompetencyRubricPanel from './CompetencyRubricPanel';
import Kpi3ElementsPanel from './Kpi3ElementsPanel';
import { KPI3_MEMO_TYPES } from '../constants/kpiRules';
import { findKpiMember } from '../constants/kpiMembers';
import { isEditorMode } from '../utils/appMode';

const LEADER_SUBTABS = [
  ['rubric-manager', '레벨·팀장평가'],
  ['elements', 'KPI3 4요소'],
  ['memos', '증빙 메모'],
];

/**
 * 팀장 업무 — 구성원 역량 팀장평가·분기 KPI3 확정
 */
export default function Kpi3LeaderWorkPanel({
  year,
  month,
  memberCode,
  yq,
  quarterRec,
  competencyRec,
  journal,
  kpiMetrics,
  onToast,
}) {
  const [subTab, setSubTab] = useState('rubric-manager');
  const [memoType, setMemoType] = useState('level');
  const [memoText, setMemoText] = useState('');
  const canEdit = isEditorMode();
  const readOnly = journal.kpiOperationalReadOnly;
  const memberRole = findKpiMember(memberCode)?.role;

  return (
    <div className="kpi3-leader-work">
      <p className="team-kpi-hint" style={{ marginTop: 0 }}>
        구성원은 <strong>역량 평가</strong> 메뉴에서 자체평가만 작성합니다. 팀장 평가 확정 후 아래에서 분기 KPI3에
        반영하세요.
      </p>
      <div className="competency-kpi3-subtabs">
        {LEADER_SUBTABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`btn btn-secondary btn-sm${subTab === id ? ' is-active' : ''}`}
            onClick={() => setSubTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'rubric-manager' && (
        <>
          <h3>팀장 평가 · {year}-{String(month + 1).padStart(2, '0')}</h3>
          <CompetencyRubricPanel
            side="manager"
            record={competencyRec}
            memberRole={memberRole}
            readOnly={readOnly || !canEdit}
            showPullButton
            onUpdate={(patch) => journal.updateCompetencyManager(year, month, memberCode, patch)}
            onPullFromSelf={() => {
              journal.pullCompetencyManagerFromSelf(year, month, memberCode);
              onToast?.('자체평가에서 가져옴');
            }}
            onLock={() => {
              journal.lockCompetencyMonth(year, month, memberCode, { side: 'manager' });
              onToast?.('팀장 평가 확정');
            }}
          />
        </>
      )}

      {subTab === 'elements' && (
        <Kpi3ElementsPanel
          year={year}
          month={month}
          memberCode={memberCode}
          yq={yq}
          quarterRec={quarterRec}
          journal={journal}
          showManagerTabs
          showCoaching={false}
          canEdit={canEdit}
          kpiMetrics={kpiMetrics}
          onToast={onToast}
        />
      )}

      {subTab === 'memos' && (
        <>
          <h3>월 증빙 메모</h3>
          <div className="team-kpi-kpi3-add">
            <select value={memoType} onChange={(e) => setMemoType(e.target.value)} className="form-input">
              {KPI3_MEMO_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              placeholder="메모"
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={readOnly}
              onClick={() => {
                journal.addKpi3Memo(year, month, memberCode, {
                  month: month + 1,
                  type: memoType,
                  text: memoText,
                });
                setMemoText('');
                onToast?.('메모 추가');
              }}
            >
              추가
            </button>
          </div>
          <ul className="team-kpi-memo-list">
            {quarterRec.memos.map((m) => (
              <li key={m.id}>
                {m.month}월 · {m.type}: {m.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
