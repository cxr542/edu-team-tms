import React from 'react';
import { parseYq } from '../constants/kpi3HeadquartersGoals';
import { noticeDeadlineStatus } from '../utils/businessDays';

/** 마감이 이 일수 넘게 지난 분기는 표시하지 않는다 (과거 분기 안내 방지) */
const HIDE_AFTER_OVERDUE_DAYS = 30;

function confirmedDateKey(confirmedAt) {
  if (!confirmedAt) return null;
  const d = new Date(confirmedAt);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 화면용 문구. 표시하지 않으면 null.
 * @returns {{ text: string, urgent: boolean, note: string|null } | null}
 */
export function describeNoticeDeadline(yq, { now = new Date(), confirmedAt = null } = {}) {
  const { quarter } = parseYq(yq);
  if (!quarter || quarter === 1) return null; // 1Q는 베이스라인(등급 평가 미적용)
  const s = noticeDeadlineStatus(yq, now);
  if (!s) return null;
  if (s.state === 'overdue' && -s.remainingDays > HIDE_AFTER_OVERDUE_DAYS) return null;

  let text;
  let urgent = false;
  if (s.state === 'before-end') {
    text = `확정 통보 마감 ${s.deadline} (분기 말 + 5영업일)`;
  } else if (s.state === 'open') {
    text = `확정 통보 마감 ${s.deadline} · D-${s.remainingDays}`;
    urgent = s.remainingDays <= 2;
  } else if (s.state === 'today') {
    text = `확정 통보 마감 오늘 (${s.deadline})`;
    urgent = true;
  } else {
    text = `확정 통보 마감 ${-s.remainingDays}일 경과 (${s.deadline})`;
    urgent = true;
  }
  const confirmed = confirmedDateKey(confirmedAt);
  if (confirmed) text += ` · 확정일 ${confirmed}`;
  const note = s.holidayDataComplete
    ? null
    : '공휴일 데이터가 없는 연도를 포함해 주말만 제외한 추정입니다.';
  return { text, urgent, note };
}

/** 분기 확정 통보 마감(분기 말 + 5영업일) 표시 — 표시 전용 */
export default function Kpi3NoticeDeadline({ yq, confirmedAt = null, block = false }) {
  const info = describeNoticeDeadline(yq, { confirmedAt });
  if (!info) return null;
  const Tag = block ? 'p' : 'span';
  return (
    <Tag
      className={`kpi3-notice-deadline${info.urgent ? ' is-urgent' : ''}`}
      title="정의서 v6: 확정 통보는 분기 말로부터 5영업일 이내 (분기 말 다음 날부터 센다)"
    >
      {info.text}
      {info.note && <span className="kpi3-notice-deadline-note"> · {info.note}</span>}
    </Tag>
  );
}
