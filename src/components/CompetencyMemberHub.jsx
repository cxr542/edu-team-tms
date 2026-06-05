import React from 'react';
import { ChevronRight } from 'lucide-react';
import AppModuleLink from './AppModuleLink';
import { COMPETENCY_PAGE_HINT } from '../constants/competencyTabs';
import { COMPETENCY_USE_4060 } from '../constants/competencyConfig';
import { URL_ACCESS_LEADER } from '../constants/teamAccess';
import {
  TEAM_KPI_MEMBERS,
  formatKpiMemberLabel,
  formatKpiMemberRoleLine,
} from '../constants/kpiMembers';
import { useJournal } from '../context/JournalProvider';
import { monthlyFinalScore } from '../utils/competencyScore';

/**
 * 역량 평가 — 구성원 선택(각 구성원별 별도 페이지로 이동)
 */
export default function CompetencyMemberHub({ year, month, canEditByCode }) {
  const journal = useJournal();

  return (
    <section className="competency-member-hub" aria-labelledby="competency-hub-heading">
      <h2 id="competency-hub-heading" className="competency-page-group__title">
        구성원 선택
      </h2>
      <p className="team-kpi-hint competency-member-hub__intro">{COMPETENCY_PAGE_HINT}</p>
      <ul className="competency-member-hub__list">
        {TEAM_KPI_MEMBERS.map((member) => {
          const rec = journal.getCompetencyMonth(year, month, member.code);
          const q = journal.getQuarterRecord(year, month, member.code).quarter;
          const monthlyFinal = monthlyFinalScore(
            rec?.self?.computed?.proposed,
            rec?.manager?.computed?.proposed,
            COMPETENCY_USE_4060
          );
          const canEdit = canEditByCode(member.code);

          return (
            <li key={member.code}>
              <AppModuleLink
                module="competency"
                mode="edit"
                member={member.code}
                access={URL_ACCESS_LEADER}
                year={year}
                month={month + 1}
                className={`competency-member-hub__card${canEdit ? ' is-editable' : ''}`}
              >
                <div className="competency-member-hub__card-head">
                  <h3 className="competency-member-hub__name">{formatKpiMemberLabel(member)}</h3>
                  <span className="competency-member-hub__role">{formatKpiMemberRoleLine(member)}</span>
                </div>
                <dl className="competency-member-hub__stats">
                  <div>
                    <dt>{month + 1}월 자체</dt>
                    <dd className={rec?.selfLocked ? 'is-done' : ''}>
                      {rec?.selfLocked ? '확정' : '작성중'}
                    </dd>
                  </div>
                  <div>
                    <dt>월간 레벨</dt>
                    <dd>{rec?.managerLocked && monthlyFinal != null ? monthlyFinal : '—'}</dd>
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
                <span className="competency-member-hub__action">
                  {canEdit ? '평가 작성' : '조회'}
                  <ChevronRight size={16} aria-hidden />
                </span>
              </AppModuleLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
