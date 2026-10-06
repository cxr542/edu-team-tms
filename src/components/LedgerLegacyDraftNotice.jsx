import { AlertCircle } from 'lucide-react';

/**
 * 서버(Supabase) 장부 모드에서, 이 브라우저에 이관 전 작성본이 남아 있고 서버와 다를 때 편집을 막고 보여 준다.
 * 자동으로 올리거나 지우지 않는다 — 백업 다운로드 후 폐기를 선택하게 한다.
 */
export default function LedgerLegacyDraftNotice({ draft, onDownloadBackup, onDiscard }) {
  if (!draft?.blocking) return null;
  return (
    <div
      className="custom-alert"
      role="alertdialog"
      aria-label="이 브라우저에 이관 전 작성본이 남아 있습니다"
      style={{
        marginBottom: '1rem',
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.45)',
        borderLeft: '4px solid #f59e0b',
      }}
    >
      <AlertCircle size={18} style={{ color: '#f59e0b' }} />
      <div className="custom-alert-content">
        <h4 style={{ color: '#fcd34d' }}>이 브라우저에 이관 전 작성본이 남아 있습니다</h4>
        <p style={{ fontSize: '0.85rem' }}>
          장부는 이제 서버(Supabase)가 기준입니다. 이 브라우저의 옛 작성본 {draft.total}건 중{' '}
          <strong>서버에 없는 항목 {draft.onlyLocal}건 · 내용이 다른 항목 {draft.differing}건</strong>이 있어,
          새 기준을 덮어쓰지 않도록 수정을 잠시 막았습니다. 먼저 백업 파일을 받아 두고, 서버 기준으로 계속하려면
          작성본을 폐기하세요. (자동으로 서버에 올리거나 지우지 않습니다.)
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onDownloadBackup}>
            작성본 백업 JSON 다운로드
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (
                window.confirm(
                  '이 브라우저의 옛 작성본을 삭제하고 서버 기준으로 계속합니다. 백업 파일을 이미 받으셨나요? 삭제 후에는 되돌릴 수 없습니다.'
                )
              ) {
                onDiscard();
              }
            }}
          >
            작성본 폐기하고 서버 기준으로 계속
          </button>
        </div>
      </div>
    </div>
  );
}
