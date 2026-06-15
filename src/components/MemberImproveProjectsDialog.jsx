import React from 'react';
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
  onPullShare,
  shareBusy,
}) {
  return (
    <MemberJournalDialog
      open={open}
      onClose={onClose}
      title="운영 중인 생산성향상 과제"
      titleId="member-improve-projects-dialog-title"
      wide
    >
      <p className="journal-field-help journal-member-dialog__lead">
        본인 일지의 생산성향상 M/M으로 등록되어 팀장이 운영 목록에 올린 과제입니다.
      </p>
      {IMPROVE_PROJECT_BLOB_SHARE_ENABLED && (
        <div className="journal-member-dialog__actions">
          <button
            type="button"
            className="btn btn-import-shared btn-sm"
            disabled={shareBusy}
            aria-label="향상 과제 팀 공유본 가져오기"
            {...uiTooltip(
              '팀장이 운영 목록에 등록·공유 저장한 본인 생산성향상 M/M 과제만 가져옵니다.',
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
      {projects.length === 0 ? (
        <p className="journal-improve-projects-panel__empty">
          본인 담당 과제가 없습니다. 생산성향상 M/M 업무 작성 후 팀장이 KPI2 운영 목록에 등록하면 여기에
          표시됩니다.
        </p>
      ) : (
        <ul className="journal-improve-projects-panel__list journal-improve-projects-panel__list--grid">
          {projects.map((p) => (
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
