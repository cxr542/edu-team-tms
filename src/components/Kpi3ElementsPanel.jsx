import React, { useEffect, useMemo, useState } from 'react';
import { buildDocsModuleUrl } from '../constants/referenceDocs';
import { KPI3_ELEMENTS, KPI3_FORMULA_TEXT } from '../constants/kpi3Elements';
import { KPI3_WEIGHTS } from '../constants/kpiRules';
import { previousQuarterLastMonthIndex } from '../constants/kpiOperationalStore';
import { quarterMonthKeys } from '../utils/competencyScore';
import {
  computeKpi3Composite,
  gradeKpi1,
  gradeKpi2,
  gradeKpi3,
} from '../utils/kpiGrades';
import {
  computeDmScore,
  computeLeaderScore,
  computePracticeScore,
  leaderScoreFromKpiGrades,
} from '../utils/kpi3ElementScores';
import {
  DM_DUAL_DEFAULT_LECTURE_PCT,
  DM_DUAL_LECTURE_PCT_MAX,
  DM_DUAL_LECTURE_PCT_MIN,
  DM_PROFILE,
  dmProfileHint,
  resolveDmProfile,
} from '../constants/kpi3DmProfile';
import { findKpiMember, formatKpiMemberLabel } from '../constants/kpiMembers';
import {
  DM_WEIGHT_MODE_JOURNAL,
  DM_WEIGHT_MODE_MANUAL,
  clampManualLecturePct,
  computeQuarterDmActivityWeights,
  resolveDualDmWeights,
} from '../utils/kpi3DmMm';
import Kpi3CoachingReport from './Kpi3CoachingReport';
import './Kpi3ElementsPanel.css';

function num(v) {
  if (v === '' || v == null) return NaN;
  return Number(v);
}

function scoreDisplay(v) {
  if (v == null || Number.isNaN(v) || v === 0) return '—';
  return String(v);
}

function Kpi3GridField({ title, hint, muted, secondary, children }) {
  const className = [
    'kpi3-field',
    muted && 'kpi3-field--muted',
    secondary && 'kpi3-field--secondary',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <label className={className}>
      <span className="kpi3-field-label">
        <span className="kpi3-field-title">{title}</span>
        {hint ? <span className="kpi3-field-hint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function journalCapLabel(journal) {
  if (!journal) return '';
  const l = Math.round((journal.lectureWeight ?? 0) * 100);
  const o = Math.round((journal.opsWeight ?? 0) * 100);
  return `${l}:${o}`;
}

function readDmWeightDraft(dmDetail) {
  return {
    mode: dmDetail.weightMode === DM_WEIGHT_MODE_MANUAL ? DM_WEIGHT_MODE_MANUAL : DM_WEIGHT_MODE_JOURNAL,
    manualPct: clampManualLecturePct(
      dmDetail.manualLecturePct !== '' && dmDetail.manualLecturePct != null
        ? dmDetail.manualLecturePct
        : DM_DUAL_DEFAULT_LECTURE_PCT
    ),
  };
}

function Kpi3PreviewRow({ children, action }) {
  return (
    <div className="kpi3-elements-preview">
      <p className="kpi3-elements-preview-text team-kpi-hint">{children}</p>
      {action}
    </div>
  );
}

export default function Kpi3ElementsPanel({
  year,
  month,
  memberCode,
  yq,
  quarterRec,
  journal,
  showManagerTabs,
  /** 구성원 역량 평가 — 다면 만족도·N 입력 허용 */
  allowMemberDmEdit = false,
  /** 팀 KPI 관리 등 — 평가 분석(컨설팅) 블록 숨김 */
  showCoaching = true,
  /** 'level' | 'dm' | 'leader' | 'practice' — 단일 요소만 표시(역량 평가 탭) */
  section = null,
  /** 단일 섹션 모드: 상단 요약·공식 등 생략 */
  compact = false,
  canEdit,
  kpiMetrics,
  onToast,
}) {
  const [practiceText, setPracticeText] = useState('');
  const [dmWeightDraft, setDmWeightDraft] = useState(() => readDmWeightDraft({}));
  const [dmWeightApplyModal, setDmWeightApplyModal] = useState(null);
  const locked = quarterRec.quarter.locked;
  const readOnly = journal.kpiOperationalReadOnly || !canEdit;
  const canEditDmDetail = showManagerTabs || allowMemberDmEdit;
  const canApplyQuarterScore = showManagerTabs;
  const q = quarterRec.quarter;
  const dmDetail = quarterRec.dmDetail || {};
  const leaderDetail = quarterRec.leaderDetail || {};
  const practiceDetail = quarterRec.practiceDetail || { cases: [] };

  const isMemberQuarterInput = !showManagerTabs && Boolean(section);
  const isSubmittedForReview = (detail) =>
    detail?.submissionStatus === 'submitted' || Boolean(detail?.submittedAt);
  const dmSubmitted = isMemberQuarterInput && isSubmittedForReview(dmDetail);
  const leaderSubmitted = isMemberQuarterInput && isSubmittedForReview(leaderDetail);
  const practiceSubmittedForReview = isMemberQuarterInput && isSubmittedForReview(practiceDetail);

  const updateQuarterSubmission = (sectionKey, submitted) => {
    const detailKey =
      sectionKey === 'dm'
        ? 'dmDetail'
        : sectionKey === 'leader'
          ? 'leaderDetail'
          : 'practiceDetail';
    const patch = submitted
      ? {
          submissionStatus: 'submitted',
          submittedAt: new Date().toISOString(),
          submittedBy: memberCode,
        }
      : {
          submissionStatus: '',
          submittedAt: '',
          submittedBy: '',
        };

    journal.updateKpi3QuarterExtras(year, month, memberCode, {
      [detailKey]: patch,
    });

    onToast?.(
      submitted
        ? '분기 평가 입력을 팀장에게 제출했습니다'
        : '분기 평가 제출을 취소했습니다'
    );
  };

  const renderMemberSubmissionActions = (sectionKey, detail) => {
    if (!isMemberQuarterInput) return null;
    const submitted = isSubmittedForReview(detail);
    return (
      <div className="kpi3-member-submit-actions">
        {submitted ? (
          <>
            <p className="team-kpi-hint kpi3-member-submit-actions__hint">
              팀장 검토 대기 중입니다. 검토 전까지 제출을 취소하고 다시 수정할 수 있습니다.
            </p>
            {!readOnly && !locked && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => updateQuarterSubmission(sectionKey, false)}
              >
                제출 취소 후 수정
              </button>
            )}
          </>
        ) : (
          <>
            <p className="team-kpi-hint kpi3-member-submit-actions__hint">
              입력을 마쳤다면 팀장에게 제출해 주세요.
            </p>
            {!readOnly && !locked && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => updateQuarterSubmission(sectionKey, true)}
              >
                팀장에게 제출
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  const compositeLive = useMemo(() => computeKpi3Composite(q), [q]);
  const memberLabel = formatKpiMemberLabel(findKpiMember(memberCode));
  const coachingContext = useMemo(
    () => ({
      levelAuto: q.levelAuto,
      approvedPractice: (practiceDetail.cases || []).filter((c) => c.approved).length,
      practiceSubmitted: (practiceDetail.cases || []).length,
    }),
    [q.levelAuto, practiceDetail.cases]
  );

  const member = findKpiMember(memberCode);
  const dmProfile = resolveDmProfile(member?.role);
  const dmJournalWeights = useMemo(() => {
    if (dmProfile !== DM_PROFILE.DUAL || !journal.getDayData) return null;
    return computeQuarterDmActivityWeights(journal.getDayData, year, month, memberCode);
  }, [dmProfile, journal.getDayData, year, month, memberCode]);

  useEffect(() => {
    setDmWeightDraft(readDmWeightDraft(dmDetail));
  }, [year, month, memberCode, dmDetail.weightMode, dmDetail.manualLecturePct]);

  const dmDualWeightsSaved = useMemo(() => {
    if (dmProfile !== DM_PROFILE.DUAL) return null;
    return resolveDualDmWeights(dmJournalWeights, dmDetail);
  }, [dmProfile, dmJournalWeights, dmDetail]);

  const dmDualWeightsPreview = useMemo(() => {
    if (dmProfile !== DM_PROFILE.DUAL) return null;
    return resolveDualDmWeights(dmJournalWeights, {
      ...dmDetail,
      weightMode: dmWeightDraft.mode,
      manualLecturePct: String(dmWeightDraft.manualPct),
    });
  }, [dmProfile, dmJournalWeights, dmDetail, dmWeightDraft]);

  const dmWeightSaved = readDmWeightDraft(dmDetail);
  const dmWeightDirty =
    dmProfile === DM_PROFILE.DUAL &&
    (dmWeightDraft.mode !== dmWeightSaved.mode || dmWeightDraft.manualPct !== dmWeightSaved.manualPct);

  const applyDmWeight = () => {
    const pct = clampManualLecturePct(dmWeightDraft.manualPct);
    const mode = dmWeightDraft.mode;
    journal.updateKpi3QuarterExtras(year, month, memberCode, {
      dmDetail: {
        weightMode: mode,
        manualLecturePct: mode === DM_WEIGHT_MODE_MANUAL ? String(pct) : dmDetail.manualLecturePct,
      },
    });
    const resolved = resolveDualDmWeights(dmJournalWeights, {
      ...dmDetail,
      weightMode: mode,
      manualLecturePct: String(pct),
    });
    const ratioText = `${resolved.lecturePct}:${resolved.opsPct}`;
    const body =
      mode === DM_WEIGHT_MODE_MANUAL
        ? `강의 ${resolved.lecturePct}% · 운영 ${resolved.opsPct}% 비중이 이 분기 다면 산출에 반영되었습니다. (${ratioText})`
        : `분기 일지 M/M 기준 가중 ${ratioText}이(가) 다면 산출에 반영되었습니다.`;
    setDmWeightApplyModal({ title: '가중 비율 반영 완료', body });
    onToast?.('다면 가중 비율이 반영되었습니다');
  };

  const dmPreview = useMemo(() => {
    const prevMi = previousQuarterLastMonthIndex(month);
    const prevYear = month < 3 ? year - 1 : year;
    const prevRec = journal.getQuarterRecord(prevYear, prevMi, memberCode);
    const prevDm = prevRec?.dmDetail || {};
    const activityWeights =
      dmProfile === DM_PROFILE.DUAL && dmDualWeightsPreview
        ? {
            lectureWeight: dmDualWeightsPreview.lectureWeight,
            opsWeight: dmDualWeightsPreview.opsWeight,
          }
        : undefined;
    return computeDmScore(dmDetail, {
      dmProfile,
      activityWeights,
      prevQuarter: {
        lectureAvg: num(prevDm.lectureAvg) || prevRec?.quarter?.dm,
        opsAvg: num(prevDm.opsAvg) || prevRec?.quarter?.dm,
        teamLevelFallback: q.level > 0 ? q.level : undefined,
      },
    });
  }, [dmDetail, dmDualWeightsPreview, dmProfile, journal, memberCode, month, q.level, year]);

  const kpiGradeHint = useMemo(() => {
    if (!kpiMetrics) return null;
    const g1 = gradeKpi1(kpiMetrics.kpi1?.utilizationPct);
    const g2 = gradeKpi2(kpiMetrics.kpi2?.productivityPct);
    return { g1, g2, suggested: leaderScoreFromKpiGrades(g1, g2) };
  }, [kpiMetrics]);

  const applyScore = (key, value) => {
    if (value == null || Number.isNaN(value)) {
      onToast?.('입력값을 확인하세요');
      return;
    }
    journal.updateKpi3Quarter(year, month, memberCode, { [key]: value });
    onToast?.(`${KPI3_ELEMENTS.find((e) => e.key === key)?.label} 점수 반영`);
  };

  const showLevelSection = !section || section === 'level';
  const showDmSection = !section || section === 'dm';
  const showLeaderSection = !section || section === 'leader';
  const showPracticeSection = !section || section === 'practice';
  const showPanelShell = !compact && !section;

  return (
    <div className={`kpi3-elements${compact ? ' kpi3-elements--compact' : ''}`}>
      {showPanelShell && (
        <>
          <p className="kpi3-elements-formula">{KPI3_FORMULA_TEXT}</p>
          <p className="team-kpi-hint">
            <a href={buildDocsModuleUrl('kpi-definition')} target="_blank" rel="noopener noreferrer">
              KPI 정의서
            </a>
            에서 4요소·N기준·승인 절차를 확인하세요. 아래는 정의서에 맞춘 입력·산출 UI입니다.
          </p>
        </>
      )}

      {showPanelShell && (
        <div className="kpi3-elements-summary" role="region" aria-label="분기 4요소 요약">
          {KPI3_ELEMENTS.map((el) => (
            <div key={el.key} className={`kpi3-elements-chip kpi3-elements-chip--${el.key}`}>
              <span className="kpi3-elements-chip-label">
                {el.label} ({el.weightPct}%)
              </span>
              <strong>{scoreDisplay(q[el.key])}</strong>
            </div>
          ))}
          <div className="kpi3-elements-chip kpi3-elements-chip--total">
            <span className="kpi3-elements-chip-label">종합</span>
            <strong>{compositeLive > 0 ? compositeLive : scoreDisplay(q.composite)}</strong>
            <span className="kpi3-elements-grade">등급 {gradeKpi3(compositeLive || q.composite)}</span>
          </div>
        </div>
      )}

      {compact && section && section !== 'level' && (
        <p className="kpi3-elements-compact-score team-kpi-hint">
          분기 반영 점수: <strong>{scoreDisplay(q[section])}</strong>
        </p>
      )}

      {showCoaching && showPanelShell && (
        <Kpi3CoachingReport
          quarter={{ ...q, composite: compositeLive > 0 ? compositeLive : q.composite }}
          yq={yq}
          memberLabel={memberLabel}
          context={coachingContext}
        />
      )}

      {showLevelSection && (
      <section className="kpi3-elements-section">
        <h3>① 레벨 ({Math.round(KPI3_WEIGHTS.level * 100)}%)</h3>
        <p className="team-kpi-hint">{KPI3_ELEMENTS[0].summary}</p>
        <ul className="team-kpi-memo-list">
          {quarterMonthKeys(year, month).map((ym) => {
            const mIdx = parseInt(ym.split('-')[1], 10) - 1;
            return (
              <li key={ym}>
                {ym}: 월간 {journal.getCompetencyMonthlyFinal(year, mIdx, memberCode) ?? '—'}
                {journal.getCompetencyMonth(year, mIdx, memberCode)?.managerLocked ? ' (팀장 확정)' : ''}
              </li>
            );
          })}
        </ul>
        {showManagerTabs && !readOnly && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              journal.rollupCompetencyToKpi3Quarter(year, month, memberCode);
              onToast?.('월간 역량 평가 → 분기 레벨 반영');
            }}
          >
            월간 확정 평균 → 분기 레벨 반영
          </button>
        )}
        {showManagerTabs && (
          <label className="kpi3-elements-score-row">
            분기 레벨 점수 (수동 조정)
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="form-input"
              value={q.level ?? 0}
              disabled={locked || readOnly}
              onChange={(e) =>
                journal.updateKpi3Quarter(year, month, memberCode, {
                  level: Number(e.target.value),
                  levelAuto: false,
                })
              }
            />
          </label>
        )}
        {q.levelAuto && <p className="team-kpi-kpi3-level-auto">레벨: 역량 평가 분기 평균 자동 반영</p>}
        {!showManagerTabs && (
          <p className="team-kpi-hint">
            월간 레벨은 「레벨·자체평가」에서 작성하고, 팀장 확정 후 분기 레벨에 반영됩니다.
          </p>
        )}
      </section>
      )}

      {showDmSection && (
      <section className="kpi3-elements-section">
        <h3>② 다면 평가{showManagerTabs ? ` (${Math.round(KPI3_WEIGHTS.dm * 100)}%)` : ''}</h3>
        <p className="team-kpi-hint">{dmProfileHint(dmProfile)}</p>
        {dmProfile === DM_PROFILE.DUAL && dmDualWeightsPreview && (
          <div className="kpi3-dm-weight-panel" role="region" aria-label="겸업 다면 가중">
            {showManagerTabs && !readOnly && !locked ? (
              <div className="kpi3-dm-weight-modes">
                <label className="kpi3-dm-weight-mode">
                  <input
                    type="radio"
                    name={`dm-weight-${memberCode}-${yq}`}
                    checked={dmWeightDraft.mode === DM_WEIGHT_MODE_JOURNAL}
                    onChange={() =>
                      setDmWeightDraft((d) => ({ ...d, mode: DM_WEIGHT_MODE_JOURNAL }))
                    }
                  />
                  <span>일지 자동</span>
                </label>
                <label className="kpi3-dm-weight-mode">
                  <input
                    type="radio"
                    name={`dm-weight-${memberCode}-${yq}`}
                    checked={dmWeightDraft.mode === DM_WEIGHT_MODE_MANUAL}
                    onChange={() =>
                      setDmWeightDraft((d) => ({
                        ...d,
                        mode: DM_WEIGHT_MODE_MANUAL,
                        manualPct:
                          d.manualPct >= DM_DUAL_LECTURE_PCT_MIN
                            ? d.manualPct
                            : DM_DUAL_DEFAULT_LECTURE_PCT,
                      }))
                    }
                  />
                  <span>
                    팀장 수동 (강의 {DM_DUAL_LECTURE_PCT_MIN}~{DM_DUAL_LECTURE_PCT_MAX}%)
                  </span>
                </label>
              </div>
            ) : (
              <p className="team-kpi-hint kpi3-dm-weight-readonly">
                가중 방식:{' '}
                {dmDualWeightsSaved?.source === DM_WEIGHT_MODE_MANUAL ? '팀장 수동' : '일지 자동'} ·{' '}
                <strong>
                  {dmDualWeightsSaved?.lecturePct}:{dmDualWeightsSaved?.opsPct}
                </strong>
              </p>
            )}
            {dmWeightDraft.mode === DM_WEIGHT_MODE_JOURNAL && dmDualWeightsPreview.journal && (
              <p className="team-kpi-hint">
                분기 일지: 교육·준비 {dmDualWeightsPreview.journal.lectureHours}h · 기타(운영){' '}
                {dmDualWeightsPreview.journal.opsHours}h
                {dmDualWeightsPreview.journal.rawLecturePct != null &&
                  ` (원비율 ${dmDualWeightsPreview.journal.rawLecturePct}%)`}
                {' → '}
                <strong>
                  {dmDualWeightsPreview.lecturePct}:{dmDualWeightsPreview.opsPct}
                </strong>
                {dmDualWeightsPreview.journal.source === 'default'
                  ? ` · 일지 없음 기본 ${DM_DUAL_DEFAULT_LECTURE_PCT}:${100 - DM_DUAL_DEFAULT_LECTURE_PCT}`
                  : ''}
              </p>
            )}
            {dmWeightDraft.mode === DM_WEIGHT_MODE_MANUAL && (
              <div className="kpi3-dm-weight-manual">
                {showManagerTabs && !readOnly && !locked ? (
                  <>
                    <label className="kpi3-dm-weight-slider-label">
                      강의 비중 {dmWeightDraft.manualPct}% (운영 {100 - dmWeightDraft.manualPct}%)
                      <input
                        type="range"
                        className="kpi3-dm-weight-slider"
                        min={DM_DUAL_LECTURE_PCT_MIN}
                        max={DM_DUAL_LECTURE_PCT_MAX}
                        step={1}
                        value={dmWeightDraft.manualPct}
                        onChange={(e) =>
                          setDmWeightDraft((d) => ({
                            ...d,
                            mode: DM_WEIGHT_MODE_MANUAL,
                            manualPct: clampManualLecturePct(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label className="kpi3-dm-weight-pct-input">
                      강의 %
                      <input
                        type="number"
                        min={DM_DUAL_LECTURE_PCT_MIN}
                        max={DM_DUAL_LECTURE_PCT_MAX}
                        step={1}
                        className="form-input"
                        value={dmWeightDraft.manualPct}
                        onChange={(e) =>
                          setDmWeightDraft((d) => ({
                            ...d,
                            mode: DM_WEIGHT_MODE_MANUAL,
                            manualPct: clampManualLecturePct(e.target.value),
                          }))
                        }
                      />
                    </label>
                  </>
                ) : (
                  <p className="team-kpi-hint">
                    팀장 확정 가중:{' '}
                    <strong>
                      {dmDualWeightsSaved?.lecturePct}:{dmDualWeightsSaved?.opsPct}
                    </strong>
                  </p>
                )}
                {dmDualWeightsPreview.journal && (
                  <p className="team-kpi-hint kpi3-dm-weight-ref">
                    참고 일지: 교육·준비 {dmDualWeightsPreview.journal.lectureHours}h · 기타{' '}
                    {dmDualWeightsPreview.journal.opsHours}h
                    {dmDualWeightsPreview.journal.rawLecturePct != null &&
                      ` (${dmDualWeightsPreview.journal.rawLecturePct}%→캡 ${journalCapLabel(dmDualWeightsPreview.journal)})`}
                  </p>
                )}
              </div>
            )}
            {showManagerTabs && !readOnly && !locked && (
              <div className="kpi3-dm-weight-apply-row">
                {dmWeightDirty && (
                  <span className="kpi3-dm-weight-pending">변경 내용이 있습니다 · 적용 버튼을 눌러 저장하세요</span>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={applyDmWeight}>
                  가중 비율 적용
                </button>
              </div>
            )}
          </div>
        )}
        <div className="kpi3-elements-grid kpi3-elements-grid--quad">
          <Kpi3GridField
            title="강의 만족도 평균 (5점)"
            hint={dmProfile === DM_PROFILE.INSTRUCTOR ? '본 점수' : undefined}
            secondary={dmProfile === DM_PROFILE.PLANNER}
          >
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="form-input"
              value={dmDetail.lectureAvg ?? ''}
              disabled={locked || readOnly || !canEditDmDetail || dmSubmitted}
              onChange={(e) =>
                journal.updateKpi3QuarterExtras(year, month, memberCode, {
                  dmDetail: { lectureAvg: e.target.value },
                })
              }
            />
          </Kpi3GridField>
          <Kpi3GridField title="강의 유효 N">
            <input
              type="number"
              min={0}
              className="form-input"
              value={dmDetail.lectureN ?? ''}
              disabled={locked || readOnly || !canEditDmDetail || dmSubmitted}
              onChange={(e) =>
                journal.updateKpi3QuarterExtras(year, month, memberCode, {
                  dmDetail: { lectureN: e.target.value },
                })
              }
            />
          </Kpi3GridField>
          <Kpi3GridField
            title="운영 만족도 평균 (5점)"
            hint={
              dmProfile === DM_PROFILE.INSTRUCTOR
                ? '참고·미반영'
                : dmProfile === DM_PROFILE.PLANNER
                  ? '본 점수'
                  : undefined
            }
            muted={dmProfile === DM_PROFILE.INSTRUCTOR}
          >
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="form-input"
              value={dmDetail.opsAvg ?? ''}
              disabled={locked || readOnly || !canEditDmDetail || dmSubmitted}
              onChange={(e) =>
                journal.updateKpi3QuarterExtras(year, month, memberCode, {
                  dmDetail: { opsAvg: e.target.value },
                })
              }
            />
          </Kpi3GridField>
          <Kpi3GridField title="운영 유효 N">
            <input
              type="number"
              min={0}
              className="form-input"
              value={dmDetail.opsN ?? ''}
              disabled={locked || readOnly || !canEditDmDetail || dmSubmitted}
              onChange={(e) =>
                journal.updateKpi3QuarterExtras(year, month, memberCode, {
                  dmDetail: { opsN: e.target.value },
                })
              }
            />
          </Kpi3GridField>
        </div>
        {showManagerTabs && (
          <Kpi3PreviewRow
            action={
              canApplyQuarterScore &&
              !readOnly &&
              !locked && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => applyScore('dm', dmPreview.score)}
                >
                  분기 점수에 반영
                </button>
              )
            }
          >
            산출 미리보기: <strong>{dmPreview.score ?? '—'}</strong>
            {dmPreview.note ? ` · ${dmPreview.note}` : ''}
          </Kpi3PreviewRow>
        )}
        {renderMemberSubmissionActions('dm', dmDetail)}
      </section>
      )}

      {showLeaderSection && (
      <section className="kpi3-elements-section">
        <h3>③ 리더 평가{showManagerTabs ? ` (${Math.round(KPI3_WEIGHTS.leader * 100)}%)` : ''}</h3>
        <p className="team-kpi-hint">
          {showManagerTabs
            ? '팀원 자체평가(40%) + 팀장 평가(60%). KPI1·2 등급 환산은 참고용입니다.'
            : '이번 분기의 주도성, 일정 조율, 리딩 사례를 본인 관점에서 입력합니다.'}
        </p>
        {kpiGradeHint?.suggested != null && (
          <div className="kpi3-elements-preview">
            <p className="kpi3-elements-preview-text team-kpi-hint">
              KPI 참고: 가동 {kpiGradeHint.g1} · 생산 {kpiGradeHint.g2} → 환산 약 {kpiGradeHint.suggested}점
            </p>
            {showManagerTabs && !readOnly && !locked && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  journal.updateKpi3QuarterExtras(year, month, memberCode, {
                    leaderDetail: { managerScore: String(kpiGradeHint.suggested) },
                  });
                  onToast?.('KPI 등급 참고값을 팀장 평가란에 넣었습니다');
                }}
              >
                팀장 평가란에 참고 넣기
              </button>
            )}
          </div>
        )}
        <div className="kpi3-elements-grid kpi3-elements-grid--pair">
          <Kpi3GridField title="팀원 자체평가 (5점)">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              className="form-input"
              value={leaderDetail.memberSelf ?? ''}
              disabled={locked || readOnly || leaderSubmitted}
              onChange={(e) =>
                journal.updateKpi3QuarterExtras(year, month, memberCode, {
                  leaderDetail: { memberSelf: e.target.value },
                })
              }
            />
          </Kpi3GridField>
          {showManagerTabs && (
            <Kpi3GridField title="팀장 평가 (5점)">
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                className="form-input"
                value={leaderDetail.managerScore ?? ''}
                disabled={locked || readOnly}
                onChange={(e) =>
                  journal.updateKpi3QuarterExtras(year, month, memberCode, {
                    leaderDetail: { managerScore: e.target.value },
                  })
                }
              />
            </Kpi3GridField>
          )}
        </div>
        {showManagerTabs && (
          <Kpi3PreviewRow
            action={
              canApplyQuarterScore &&
              !readOnly &&
              !locked && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => applyScore('leader', computeLeaderScore(leaderDetail))}
                >
                  분기 점수에 반영
                </button>
              )
            }
          >
            산출 미리보기: <strong>{computeLeaderScore(leaderDetail) ?? '—'}</strong>
          </Kpi3PreviewRow>
        )}
        {renderMemberSubmissionActions('leader', leaderDetail)}
      </section>
      )}

      {showPracticeSection && (
      <section className="kpi3-elements-section">
        <h3>④ 실전 적용{showManagerTabs ? ` (${Math.round(KPI3_WEIGHTS.practice * 100)}%)` : ''}</h3>
        <p className="team-kpi-hint">
          분기 실전 사례 증빙 제출 → 팀장 인정 건수: 3건↑=5점, 2건=4점, 1건=3점, 제출만=2점.
        </p>
        {!readOnly && !locked && !practiceSubmittedForReview && (
          <div className="kpi3-elements-practice-add">
            <input
              className="form-input"
              placeholder="실전 적용 사례 (증빙 요약)"
              value={practiceText}
              onChange={(e) => setPracticeText(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const text = practiceText.trim();
                if (!text) return;
                const cases = [
                  ...(practiceDetail.cases || []),
                  { id: `p-${Date.now()}`, text, approved: false, at: new Date().toISOString() },
                ];
                journal.updateKpi3QuarterExtras(year, month, memberCode, { practiceDetail: { cases } });
                setPracticeText('');
                onToast?.('실전 사례 제출');
              }}
            >
              사례 제출
            </button>
          </div>
        )}
        <ul className="team-kpi-memo-list kpi3-practice-cases">
          {(practiceDetail.cases || []).map((c) => (
            <li key={c.id}>
              {c.text}
              {showManagerTabs && !readOnly && !locked ? (
                <button
                  type="button"
                  className={`btn btn-sm ${c.approved ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    const cases = (practiceDetail.cases || []).map((x) =>
                      x.id === c.id ? { ...x, approved: !x.approved } : x
                    );
                    journal.updateKpi3QuarterExtras(year, month, memberCode, { practiceDetail: { cases } });
                  }}
                >
                  {c.approved ? '인정 취소' : '팀장 인정'}
                </button>
              ) : (
                <span className="kpi3-practice-status">{c.approved ? '인정' : '검토중'}</span>
              )}
            </li>
          ))}
        </ul>
        {showManagerTabs && (
          <Kpi3PreviewRow
            action={
              canApplyQuarterScore &&
              !readOnly &&
              !locked && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => applyScore('practice', computePracticeScore(practiceDetail))}
                >
                  분기 점수에 반영
                </button>
              )
            }
          >
            산출 미리보기: <strong>{computePracticeScore(practiceDetail) ?? '—'}</strong>
          </Kpi3PreviewRow>
        )}
        {renderMemberSubmissionActions('practice', practiceDetail)}
      </section>
      )}

      {showManagerTabs && !section && (
        <section className="kpi3-elements-section kpi3-elements-lock">
          <p>
            종합 <strong>{compositeLive > 0 ? compositeLive : '—'}</strong> · 등급{' '}
            <strong>{gradeKpi3(compositeLive || q.composite)}</strong>
            {locked ? ' · 확정됨' : ''}
          </p>
          {!locked && !readOnly && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                journal.lockKpi3Quarter(year, month, memberCode);
                onToast?.('분기 확정 잠금');
              }}
            >
              분기 확정
            </button>
          )}
        </section>
      )}

      {dmWeightApplyModal && (
        <div
          className="team-kpi-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kpi3-dm-weight-modal-title"
          onClick={() => setDmWeightApplyModal(null)}
        >
          <div className="team-kpi-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="kpi3-dm-weight-modal-title">{dmWeightApplyModal.title}</h3>
            <p className="team-kpi-hint" style={{ marginTop: '0.5rem' }}>
              {dmWeightApplyModal.body}
            </p>
            <div className="team-kpi-modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setDmWeightApplyModal(null)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
