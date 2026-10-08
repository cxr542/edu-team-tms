import React, { useState } from 'react';
import { Import } from 'lucide-react';
import { findKpiMember } from '../constants/kpiMembers';
import { IMPROVE_PROJECT_BLOB_SHARE_ENABLED } from '../constants/improveProjectsShare';
import { formatImproveProjectOwnerLine } from '../utils/improveProjectLink';
import { uiTooltip } from '../utils/uiTooltip';
import MemberJournalDialog from './MemberJournalDialog';

export default function MemberImproveProjectsDialog({
  open,
  onClose,
  projects,
  monthProjects,
  monthLabel,
  onPullShare,
  shareBusy,
}) {
  const [showAll, setShowAll] = useState(false);
  const hasMonthFilter = Array.isArray(monthProjects);
  const monthOnly = hasMonthFilter && !showAll;
  const shown = monthOnly ? monthProjects : projects;
  return (
    <MemberJournalDialog
      open={open}
      onClose={onClose}
      title="운영 중인 생산성향상 과제"
      titleId="member-improve-projects-dialog-title"
      wide
    >
      <p className="journal-field-help journal-member-dialog__lead">
        본인 일지의 생산성향상 M/D로 등록되어 팀장이 운영 목록에 올린 과제입니다.
      </p>
      {IMPROVE_PROJECT_BLOB_SHARE_ENABLED && (
        <div className="journal-member-dialog__actions">
          <button
            type="button"
            className="btn btn-import-shared btn-sm"
            disabled={shareBusy}
            aria-label="향상 과제 팀 공유본 가져오기"
            {...uiTooltip(
              '팀장이 운영 목록에 등록·공유 저장한 본인 생산성향상 M/D 과제만 가져옵니다.',
              undefined,
              { wrap: true }
            )}
            onClick={onPullShare}
          >
            <Import size={16} />
            팀 공유본 가져오기
          </button>
        </div>
      )}
      {hasMonthFilter && (
        <div className="journal-member-dialog__actions">
          <button
            type="button"
            className="btn btn-sm"
            aria-pressed={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {monthOnly ? `${monthLabel} 과제만 (${monthProjects.length}건) · 전체 보기 (${projects.length}건)` : `전체 과제 (${projects.length}건) · ${monthLabel}만 보기`}
          </button>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="journal-improve-projects-panel__empty">
          {monthOnly && projects.length > 0
            ? `${monthLabel}에 해당하는 과제가 없습니다. 전체 보기로 다른 달 과제를 확인하세요.`
            : '본인 담당 과제가 없습니다. 생산성향상 M/D 업무 작성 후 팀장이 KPI2 운영 목록에 등록하면 여기에 표시됩니다.'}
        </p>
      ) : (
        <ul className="journal-improve-projects-panel__list journal-improve-projects-panel__list--grid">
          {shown.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              <span className="journal-improve-projects-panel__meta">
                {formatImproveProjectOwnerLine(p, (code) => {
                  const m = findKpiMember(code);
                  return m ? `${m.code}(${m.displayName})` : code;
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </MemberJournalDialog>
  );
}
