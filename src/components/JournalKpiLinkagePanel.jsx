import {
  describeTaskKpiLinkage,
  KPI_SYSTEM_LABEL,
} from '../constants/kpiLinkage';
import { KPI1_NAME, KPI2_NAME, KPI1_BADGE, KPI2_BADGE } from '../constants/kpiDisplayNames';

export function TaskKpiBadge({ task, dayKey, improveProjects = [] }) {
  const link = describeTaskKpiLinkage(task, dayKey, improveProjects);
  if (!link) return null;

  return (
    <span className="journal-task-kpi-badge" title={`${link.kpi1Sheet} / ${link.kpi2Sheet}`}>
      <span className={`journal-task-kpi-badge__axis ${link.axis}`} title={KPI1_NAME}>
        {KPI1_BADGE}
      </span>
      {link.isEffect && (
        <span className="journal-task-kpi-badge__kpi2" title={KPI2_NAME}>
          {KPI2_BADGE}
        </span>
      )}
    </span>
  );
}

export function JournalEditKpiPreview({ task, dayKey, improveProjects = [] }) {
  const link = describeTaskKpiLinkage(task, dayKey, improveProjects);
  if (!link) {
    return (
      <div className="journal-edit-kpi-preview">
        <h4>KPI 연계</h4>
        <p className="journal-edit-kpi-preview__muted">휴일 메모 등은 {KPI2_NAME} 행에 포함되지 않습니다.</p>
      </div>
    );
  }

  return (
    <div className="journal-edit-kpi-preview">
      <h4>{KPI_SYSTEM_LABEL} 연계 미리보기</h4>
      <ul>
        {link.kpi1 && (
          <li>
            <span className="journal-edit-kpi-preview__tag kpi1">{KPI1_NAME}</span>
            <code>{link.kpi1Sheet}</code> — {link.kpi1}
          </li>
        )}
        {link.kpi2 && (
          <li>
            <span className="journal-edit-kpi-preview__tag kpi2">{KPI2_NAME}</span>
            <code>{link.kpi2Sheet}</code> — {link.kpi2}
            {link.kpi2Comment && (
              <span className="journal-edit-kpi-preview__comment">코멘트: {link.kpi2Comment}</span>
            )}
          </li>
        )}
      </ul>
      {link.dayKey && <p className="journal-edit-kpi-preview__muted">완료일 열: {link.dayKey}</p>}
    </div>
  );
}
