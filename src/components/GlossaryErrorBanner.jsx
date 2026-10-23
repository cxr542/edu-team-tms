import React from 'react';
import { AlertCircle, X } from 'lucide-react';

/**
 * 용어사전 오류·경고 배너. 서버 저장 실패나 목록 불러오기 실패처럼 사용자가 꼭 알아야 하는 문구를 보여 준다.
 * 메시지가 없으면 아무것도 그리지 않는다.
 */
export default function GlossaryErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="glossary-alert" role="alert">
      <AlertCircle size={16} className="glossary-alert__icon" aria-hidden="true" />
      <span className="glossary-alert__text">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          className="glossary-alert__close"
          onClick={onDismiss}
          aria-label="오류 알림 닫기"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
