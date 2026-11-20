import React from 'react';
import { describeNoticeDeadline } from '../utils/kpi3NoticeDeadline';

/** 분기 확정 통보 마감(분기 말 + 5영업일) 표시 — 표시 전용 */
export default function Kpi3NoticeDeadline({ yq, confirmedAt = null, noticedAt = null, block = false }) {
  const info = describeNoticeDeadline(yq, { confirmedAt, noticedAt });
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
