import React, { useState } from 'react';
import { X, Smartphone, Copy, Check, ExternalLink } from 'lucide-react';
import { TMS_VIEW_URL, TMS_EDIT_URL } from '../constants/appUrls';
import { IPHONE_HOME_SCREEN_MEMO } from '../constants/mobileHomeMemo';

function CopyRow({ label, url, hint }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('아래 주소를 복사하세요', url);
    }
  };

  return (
    <div className="mobile-guide-url-row">
      <div>
        <div className="mobile-guide-url-label">{label}</div>
        {hint && <div className="mobile-guide-url-hint">{hint}</div>}
        <code className="mobile-guide-url">{url}</code>
      </div>
      <div className="mobile-guide-url-actions">
        <button type="button" className="btn btn-secondary" onClick={handleCopy} title="URL 복사">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? '복사됨' : '복사'}
        </button>
        <a href={url} className="btn btn-secondary" title="새 탭에서 열기">
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}

export default function MobileHomeGuideModal({ isOpen, onClose, isViewer }) {
  const [memoCopied, setMemoCopied] = useState(false);

  const copyMemoForNotes = async () => {
    try {
      await navigator.clipboard.writeText(IPHONE_HOME_SCREEN_MEMO);
      setMemoCopied(true);
      setTimeout(() => setMemoCopied(false), 2500);
    } catch {
      window.prompt('아래 내용을 iPhone 메모 앱에 붙여넣으세요', IPHONE_HOME_SCREEN_MEMO);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" role="dialog" aria-labelledby="mobile-guide-title">
      <div className="modal-content mobile-guide-modal">
        <div className="modal-header">
          <h3 id="mobile-guide-title">
            <Smartphone size={20} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
            홈 화면에 추가
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <p className="mobile-guide-lead">
          북마크보다 편하게, 홈 화면 아이콘으로 열 수 있습니다.{' '}
          <strong>조회</strong>와 <strong>편집(팀장)</strong>은 URL이 달라서 아이콘을 두 개 만드는 것을 권장합니다.
        </p>

        <CopyRow label="조회 (팀원·열람)" url={TMS_VIEW_URL} hint="공개 조회 화면" />
        <CopyRow
          label="편집 (팀장·작성)"
          url={TMS_EDIT_URL}
          hint="지출 입력·수정 — 팀장용"
        />

        <div className="mobile-guide-memo-box">
          <p className="mobile-guide-memo-title">iPhone은 Safari 필수</p>
          <p className="mobile-guide-memo-text">
            Chrome·카톡 링크로는 「홈 화면에 추가」가 안 되거나 불편할 수 있습니다. 나중에 설정할 때는
            아래 버튼으로 메모 앱에 붙여넣어 두세요.
          </p>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={copyMemoForNotes}>
            {memoCopied ? <Check size={16} /> : <Copy size={16} />}
            {memoCopied ? '메모에 복사됨' : 'iPhone용 안내 — 메모에 복사'}
          </button>
        </div>

        <div className="mobile-guide-steps">
          <h4>iPhone (Safari)</h4>
          <ol>
            <li>위 URL 중 하나를 연다{isViewer ? ' (지금은 조회 URL 권장)' : ''}.</li>
            <li>
              <strong>공유</strong> → <strong>홈 화면에 추가</strong>
            </li>
            <li>이름 예: 「교육팀 장부」 / 「TMS 편집」→ 추가</li>
          </ol>

          <h4>Android (Chrome)</h4>
          <ol>
            <li>URL을 연 뒤 메뉴(⋮) → <strong>홈 화면에 추가</strong> 또는 <strong>앱 설치</strong></li>
          </ol>
        </div>

        <p className="mobile-guide-note">
          앱스토어 설치는 필요 없습니다. 아이콘은 교육팀 TMS(녹색 막대)로 표시됩니다.
        </p>

        <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
