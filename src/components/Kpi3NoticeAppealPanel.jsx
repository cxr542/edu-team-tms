import React, { useState } from 'react';
import { appealDeadlineStatus, todayKey } from '../utils/businessDays';
import {
  APPEAL_STATUS_LIST,
  appealTimeliness,
  normalizeAppeals,
} from '../utils/kpiAppeals';

const TIMELINESS_LABEL = {
  'in-time': '기한 내 접수',
  late: '기한 경과 후 접수',
  'before-notice': '통보 전 접수',
  'no-notice': '통보일 미기록',
};

/**
 * 확정 통보일·이의 제기 기록 (정의서 v6: 통보 후 5영업일 이내 서면 제출 → 팀장 1차, 본부장 2차 검토)
 * 기록 전용 — 알림 발송·점수 변경은 하지 않는다.
 */
export default function Kpi3NoticeAppealPanel({
  noticedAt,
  appeals,
  readOnly = false,
  onSetNoticeDate,
  onAddAppeal,
  onUpdateAppeal,
}) {
  const list = normalizeAppeals(appeals);
  const [receivedAt, setReceivedAt] = useState(todayKey());
  const [text, setText] = useState('');
  const status = appealDeadlineStatus(noticedAt);

  const add = () => {
    const res = onAddAppeal?.({ receivedAt, text });
    if (res?.ok) setText('');
  };

  return (
    <div className="kpi3-notice-appeal">
      <div className="kpi3-notice-appeal-row">
        <label>
          확정 통보일
          <input
            type="date"
            className="form-input"
            value={noticedAt || ''}
            disabled={readOnly}
            onChange={(e) => onSetNoticeDate?.(e.target.value || null)}
          />
        </label>
        {!readOnly && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSetNoticeDate?.(todayKey())}>
            오늘로 기록
          </button>
        )}
        {status && <span className="team-kpi-hint">이의 제기 기한 {status.deadline} (통보 후 5영업일)</span>}
      </div>

      <h4 className="kpi3-notice-appeal-title">이의 제기 기록 ({list.length}건)</h4>
      {list.length === 0 && <p className="team-kpi-hint">접수된 이의가 없습니다.</p>}
      <ul className="kpi3-appeal-list">
        {list.map((a) => (
          <li key={a.id} className="kpi3-appeal-item">
            <div className="kpi3-appeal-head">
              <strong>접수 {a.receivedAt}</strong>
              <span className={`kpi3-appeal-tag${appealTimeliness(a.receivedAt, noticedAt) === 'late' ? ' is-late' : ''}`}>
                {TIMELINESS_LABEL[appealTimeliness(a.receivedAt, noticedAt)]}
              </span>
            </div>
            <p className="kpi3-appeal-text">{a.text}</p>
            <div className="kpi3-notice-appeal-row">
              <label>
                처리 단계
                <select
                  className="form-input"
                  value={a.status}
                  disabled={readOnly}
                  onChange={(e) => onUpdateAppeal?.(a.id, { status: e.target.value })}
                >
                  {APPEAL_STATUS_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="kpi3-appeal-note">
                처리 메모
                <input
                  type="text"
                  className="form-input"
                  defaultValue={a.reviewNote}
                  disabled={readOnly}
                  onBlur={(e) => {
                    if (e.target.value !== a.reviewNote) onUpdateAppeal?.(a.id, { reviewNote: e.target.value });
                  }}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      {!readOnly && (
        <div className="kpi3-appeal-add">
          <div className="kpi3-notice-appeal-row">
            <label>
              접수일
              <input type="date" className="form-input" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            </label>
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="이의 내용 (서면 제출 요지)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" className="btn btn-secondary btn-sm" disabled={!text.trim()} onClick={add}>
            이의 접수 기록
          </button>
        </div>
      )}
    </div>
  );
}
