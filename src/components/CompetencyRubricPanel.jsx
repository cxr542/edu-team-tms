import React, { useMemo, useState } from 'react';
import {
  COMPETENCY_DIMS,
  COMPETENCY_DIM_IDS,
  COMPETENCY_ROLES,
  accumulationOrderForRole,
  DIM_MET,
  DIM_UNMET,
  defaultCompetencyDims,
  orderedDimsForDisplay,
  resolveEffectiveCompetencyRoleId,
} from '../constants/competencyRubric';
import {
  ROLE_ACCUMULATION_HINTS,
  ROLE_RUBRIC_HINTS,
  INTEGER_LEVELS,
  integerLevelOptionLabel,
  rubricObserveText,
  rubricRowsOrderedForRole,
} from '../constants/competencyRubricText';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import {
  applyDimChange,
  countConsecutiveMetFromStart,
  isValidCompetencyIntLevel,
  monthlyFinalScore,
  normalizeCompetencyEvalSide,
} from '../utils/competencyScore';
import './CompetencyRubricPanel.css';

function DimSelect({ value, onChange, disabled }) {
  const resolved = value === DIM_MET ? DIM_MET : DIM_UNMET;
  return (
    <select
      className="form-input competency-dim-select"
      value={resolved}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value={DIM_MET}>충족</option>
      <option value={DIM_UNMET}>미충족</option>
    </select>
  );
}

export default function CompetencyRubricPanel({
  side,
  record,
  readOnly,
  onUpdate,
  onPullFromSelf,
  onLock,
  onUnlockSelf,
  showPullButton = false,
  /** 구성원 자체평가 — 직군 고정·산식 숨김 */
  memberView = false,
  /** kpiMembers.role — 직군별 루브릭·누적 순서 표시 */
  memberRole = null,
}) {
  const [showIntLevelRef, setShowIntLevelRef] = useState(false);
  const [showDimRef, setShowDimRef] = useState(false);
  const evalSide = side === 'self' ? record?.self : record?.manager;
  const selfLocked = record?.selfLocked;
  const managerLocked = Boolean(record?.managerLocked);
  const locked = side === 'self' ? selfLocked : record?.managerLocked;
  const canUnlockSelf =
    memberView &&
    side === 'self' &&
    locked &&
    !managerLocked &&
    !readOnly &&
    typeof onUnlockSelf === 'function';
  const roleId = resolveEffectiveCompetencyRoleId(record?.roleId, memberRole, { memberView });
  const displayDims = useMemo(() => orderedDimsForDisplay(roleId), [roleId]);
  const rubricRows = useMemo(() => rubricRowsOrderedForRole(roleId), [roleId]);
  const liveEvalSide = useMemo(
    () => (evalSide ? normalizeCompetencyEvalSide(evalSide, roleId) : null),
    [evalSide, roleId]
  );
  const computed = liveEvalSide?.computed;
  const consecutiveMet = countConsecutiveMetFromStart(liveEvalSide?.dims, roleId);
  const hasValidIntLevel = isValidCompetencyIntLevel(liveEvalSide?.intLevel);
  const roleLabel = COMPETENCY_ROLES.find((r) => r.id === roleId)?.label || roleId;

  const monthlyFinal = useMemo(() => {
    if (!record) return null;
    return monthlyFinalScore(
      record.self?.computed?.proposed,
      record.manager?.computed?.proposed,
      COMPETENCY_USE_4060
    );
  }, [record]);

  const handleIntLevel = (v) => {
    onUpdate({ intLevel: v === '' ? 0 : Number(v) });
  };

  const handleDim = (dimId, v) => {
    const current = liveEvalSide?.dims || defaultCompetencyDims();
    const nextDims = applyDimChange(current, dimId, v, roleId);
    onUpdate({ dims: nextDims });
  };

  const handleRole = (v) => {
    onUpdate({ roleId: v });
  };

  const accumulationHint =
    ROLE_ACCUMULATION_HINTS[roleId] ||
    accumulationOrderForRole(roleId)
      .map((id) => COMPETENCY_DIMS.find((d) => d.id === id)?.label)
      .filter(Boolean)
      .join(' → ');

  return (
    <div className={`competency-rubric-panel${memberView ? ' competency-rubric-panel--member' : ''}`}>
      <div className="competency-rubric-toolbar">
        {memberView ? (
          <p className="competency-rubric-role-readonly">
            직군 <strong>{roleLabel}</strong>
          </p>
        ) : (
          <label>
            직군
            <select
              className="form-input"
              value={record?.roleId || roleId}
              disabled={readOnly || locked}
              onChange={(e) => handleRole(e.target.value)}
            >
              {COMPETENCY_ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          정수레벨
          <select
            className="form-input"
            value={hasValidIntLevel ? liveEvalSide.intLevel : ''}
            disabled={readOnly || locked}
            onChange={(e) => handleIntLevel(e.target.value)}
          >
            <option value="">정수 레벨 선택</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {integerLevelOptionLabel(n)}
              </option>
            ))}
          </select>
        </label>
        {showPullButton && !readOnly && !locked && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onPullFromSelf}>
            자체평가에서 가져오기
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowIntLevelRef((s) => !s)}
        >
          {showIntLevelRef ? '정수레벨 기준 닫기' : '정수레벨 기준 보기'}
        </button>
      </div>

      {ROLE_RUBRIC_HINTS[roleId] && (
        <p className="team-kpi-hint competency-role-hint">직군 힌트: {ROLE_RUBRIC_HINTS[roleId]}</p>
      )}

      {showIntLevelRef && (
        <div className="competency-rubric-ref competency-rubric-ref--int-level">
          <h4 className="competency-rubric-ref-title">정수레벨 정의 (본부 5단계)</h4>
          <p className="team-kpi-hint competency-rubric-ref-hint">
            위에서 선택한 정수레벨은 아래 정의를 기준으로 판단합니다.
            {hasValidIntLevel ? (
              <>
                {' '}
                현재 선택: <strong>{integerLevelOptionLabel(liveEvalSide.intLevel)}</strong>
              </>
            ) : null}
          </p>
          <table className="team-kpi-table competency-int-level-table">
            <thead>
              <tr>
                <th>정수레벨</th>
                <th>단계명</th>
                <th>정의</th>
              </tr>
            </thead>
            <tbody>
              {INTEGER_LEVELS.map((row) => (
                <tr
                  key={row.level}
                  className={evalSide?.intLevel === row.level ? 'competency-int-level-selected' : undefined}
                >
                  <td>{row.level}</td>
                  <td>{row.shortLabel}</td>
                  <td>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <table className="team-kpi-table competency-dim-table" aria-label="5차원 충족 여부">
        <thead>
          <tr>
            <th>차원 ({COMPETENCY_DIM_IDS.length}개)</th>
            {hasValidIntLevel ? (
              <th>정수레벨 {liveEvalSide.intLevel} 관찰 문구</th>
            ) : null}
            <th>충족 여부</th>
          </tr>
        </thead>
        <tbody>
          {displayDims.map((dim) => (
            <tr key={dim.id}>
              <td>
                {dim.label}
                <span className="visually-hidden"> ({dim.id})</span>
              </td>
              {hasValidIntLevel ? (
                <td className="competency-dim-observe">
                  {rubricObserveText(roleId, dim.id, liveEvalSide.intLevel)}
                </td>
              ) : null}
              <td>
                <DimSelect
                  value={liveEvalSide?.dims?.[dim.id]}
                  disabled={readOnly || locked}
                  onChange={(v) => handleDim(dim.id, v)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {memberView && !locked && !hasValidIntLevel && (
        <p className="team-kpi-hint competency-dim-hint">
          정수 레벨을 선택하면 각 차원의 관찰 문구(KPI 정의서 기준)가 표시됩니다.
        </p>
      )}

      {memberView && !locked && hasValidIntLevel && (
        <p className="team-kpi-hint competency-dim-hint">
          연속 충족 {consecutiveMet}/{COMPETENCY_DIM_IDS.length}단계
          {' — '}
          충족한 단계까지만 선택하면 되며, 미충족 이후 차원은 자동으로 미충족 처리됩니다.
        </p>
      )}

      <div className="competency-dim-ref-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDimRef((s) => !s)}>
          {showDimRef ? '5차원 관찰 지표 닫기' : '5차원 관찰 지표 보기'}
        </button>
      </div>

      {showDimRef && (
        <div className="competency-rubric-ref competency-rubric-ref--dims">
          <h4 className="competency-rubric-ref-title">5차원 관찰 지표 ({roleLabel})</h4>
          <p className="team-kpi-hint competency-rubric-ref-hint">
            각 차원별로 정수레벨 1~5에 해당하는 관찰 문구입니다. 문구는{' '}
            <strong>교육팀 KPI 정의서</strong> 강사·기획/운영 역량 수준 기준표와 동일합니다.
            {ROLE_RUBRIC_HINTS[roleId] ? <> 직군 초점: {ROLE_RUBRIC_HINTS[roleId]}.</> : null}
            {' '}
            소수 누적 순서: <strong>{accumulationHint}</strong>
            {evalSide?.intLevel ? (
              <>
                {' '}
                현재 선택 정수레벨 열: <strong>{integerLevelOptionLabel(evalSide.intLevel)}</strong>
              </>
            ) : null}
          </p>
          <div className="competency-rubric-table-scroll">
            <table className="team-kpi-table competency-rubric-table">
              <thead>
                <tr>
                  <th>차원</th>
                  {[1, 2, 3, 4, 5].map((lv) => {
                    const meta = INTEGER_LEVELS.find((r) => r.level === lv);
                    return (
                      <th
                        key={lv}
                        className={evalSide?.intLevel === lv ? 'competency-int-level-col-selected' : undefined}
                      >
                        정수레벨 {lv}
                        {meta ? ` · ${meta.shortLabel}` : ''}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rubricRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    {row.levels.map((text, i) => (
                      <td
                        key={i}
                        className={evalSide?.intLevel === i + 1 ? 'competency-int-level-col-selected' : undefined}
                      >
                        {text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="competency-score-summary">
        {memberView ? (
          <>
            <strong>자체평가 제안 레벨 {computed?.proposed ?? '—'}</strong>
            {hasValidIntLevel && computed?.fractional != null && computed.fractional > 0 && (
              <span className="competency-monthly-final">
                정수 {liveEvalSide.intLevel} + 차원 가산 {computed.fractional}
              </span>
            )}
            {managerLocked && monthlyFinal != null && (
              <span className="competency-monthly-final">
                팀장 확정 레벨 <strong>{monthlyFinal}</strong>
                <span className="visually-hidden"> (월별 KPI 연계)</span>
              </span>
            )}
            {!managerLocked && selfLocked && (
              <span className="competency-monthly-final competency-monthly-final--pending">
                팀장 평가·확정 대기 중
              </span>
            )}
          </>
        ) : (
          <>
            <span>누적 {computed?.accumulated ?? '—'}</span>
            <span>캡적용 {computed?.capped ?? '—'}</span>
            <span>MROUND {computed?.fractional ?? '—'}</span>
            <strong>제안 종합 {computed?.proposed ?? '—'}</strong>
            {side === 'manager' && monthlyFinal != null && (
              <span className="competency-monthly-final">
                월간 KPI 연계 {monthlyFinal}
                {COMPETENCY_USE_4060 ? ' (40:60)' : ' (팀장 확정)'}
              </span>
            )}
          </>
        )}
      </div>

      {memberView && !locked && !hasValidIntLevel && (
        <p className="team-kpi-hint competency-int-level-hint">
          정수 레벨을 1~5 중에서 선택해 주세요.
        </p>
      )}

      {side === 'self' ? (
        <div className="competency-self-actions">
          {!readOnly && !locked && (
            <button
              type="button"
              className="btn btn-primary btn-sm competency-self-lock-btn"
              disabled={!hasValidIntLevel}
              title={
                !hasValidIntLevel
                  ? '정수 레벨을 1~5 중에서 선택해야 확정할 수 있습니다.'
                  : undefined
              }
              onClick={() => {
                if (!hasValidIntLevel) return;
                onLock();
              }}
            >
              자체평가 확정
            </button>
          )}
          {locked && (
            <>
              <p className="team-kpi-hint competency-self-actions__hint">
                {memberView
                  ? canUnlockSelf
                    ? '자체평가가 확정되었습니다. 팀장 평가 전까지 아래 버튼으로 다시 수정할 수 있습니다.'
                    : managerLocked
                      ? '팀장 평가가 확정되어 자체평가를 수정할 수 없습니다.'
                      : '자체평가가 확정되었습니다. 수정이 필요하면 팀장에게 문의하세요.'
                  : '확정됨 — 수정하려면 팀장에게 문의하세요.'}
              </p>
              {canUnlockSelf && (
                <button
                  type="button"
                  className="btn btn-sm competency-self-unlock-btn"
                  onClick={() => {
                    if (
                      window.confirm(
                        '자체평가 확정을 해제하고 다시 수정하시겠습니까?'
                      )
                    ) {
                      onUnlockSelf();
                    }
                  }}
                >
                  자체평가 수정
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        !readOnly &&
        !locked && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              onLock();
            }}
          >
            팀장 평가 확정
          </button>
        )
      )}
      {locked && side === 'manager' && (
        <p className="team-kpi-hint">팀장 평가 확정됨</p>
      )}
    </div>
  );
}
