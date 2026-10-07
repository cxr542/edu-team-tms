import React, { useState } from 'react';
import { todayKey } from '../utils/businessDays';
import {
  EXEC_APPROVAL_LEVEL_THRESHOLD,
  execApprovalStatus,
  isExecApprovalRecorded,
  normalizeExecApproval,
} from '../utils/kpiExecApproval';
import { formatScoreTenth } from '../utils/kpiGrades';

/**
 * 상위(본부장/CEO) 승인 기록 — 정의서 v6: Level 4 이상은 증빙 첨부 후 본부장/CEO 최종 승인.
 * 기록 전용: 승인을 TMS에서 처리하지 않고, 받은 승인을 팀장이 기록한다. 분기 확정은 막지 않고 경고만 한다.
 */
export default function Kpi3ExecApprovalPanel({ level, execApproval, readOnly = false, onSave, onClear }) {
  const status = execApprovalStatus(level, execApproval);
  const recorded = normalizeExecApproval(execApproval);
  const [approver, setApprover] = useState(recorded?.approver || '');
  const [approvedAt, setApprovedAt] = useState(recorded?.approvedAt || todayKey());
  const [evidenceNote, setEvidenceNote] = useState(recorded?.evidenceNote || '');

  if (status === 'not-required') return null;

  return (
    <div className="kpi3-exec-approval">
      <h4 className="kpi3-exec-approval-title">
        상위 승인 (본부장/CEO) · Level {EXEC_APPROVAL_LEVEL_THRESHOLD} 이상
        <span className={`kpi3-exec-approval-tag${status === 'missing' ? ' is-missing' : ''}`}>
          {status === 'recorded' ? '기록됨' : '기록 없음'}
        </span>
      </h4>
      {status === 'missing' && (
        <p className="team-kpi-hint kpi3-exec-approval-warn">
          분기 레벨 {formatScoreTenth(level)}점으로 본부장/CEO 최종 승인(증빙 첨부)이 필요합니다. 기록이 없어도 분기 확정은
          가능하지만 확정 전에 경고합니다.
        </p>
      )}
      {status === 'recorded' && isExecApprovalRecorded(execApproval) && (
        <p className="team-kpi-hint">
          {recorded.approver} · {recorded.approvedAt}
          {recorded.evidenceNote ? ` · ${recorded.evidenceNote}` : ''}
        </p>
      )}
      {!readOnly && (
        <div className="kpi3-exec-approval-form">
          <label>
            승인자
            <input type="text" className="form-input" value={approver} onChange={(e) => setApprover(e.target.value)} />
          </label>
          <label>
            승인일
            <input type="date" className="form-input" value={approvedAt} onChange={(e) => setApprovedAt(e.target.value)} />
          </label>
          <label className="kpi3-exec-approval-note">
            증빙 메모 (메일·문서 등)
            <input type="text" className="form-input" value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!approver.trim() || !approvedAt}
            onClick={() => onSave?.({ approver, approvedAt, evidenceNote })}
          >
            승인 기록 저장
          </button>
          {recorded && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onClear?.()}>
              기록 삭제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
