/**
 * 장부 쓰기 경로 선택 (관리자 편집 화면).
 *   blob     : 브라우저 localStorage 작성본 + Blob 게시 (기존 동작, 기본값)
 *   supabase : 서버 API(/api/ledger-snapshot?resource=…)로 Supabase 에 행 단위로 즉시 저장
 * URL `?ledgerWrite=supabase|blob` 이 환경변수 `VITE_LEDGER_SUPABASE_WRITE` 보다 우선한다.
 * (쓰기는 서버가 관리자 세션을 검증하므로, URL 로 켜도 세션 없는 사용자는 쓸 수 없다.)
 */
export function resolveLedgerWriteSource({ envValue = '', search = '' } = {}) {
  const fromUrl = new URLSearchParams(search).get('ledgerWrite');
  if (fromUrl === 'supabase' || fromUrl === 'blob') return fromUrl;
  return String(envValue || '').trim().toLowerCase() === 'true' ? 'supabase' : 'blob';
}

export function getLedgerWriteSource() {
  return resolveLedgerWriteSource({
    envValue: import.meta.env?.VITE_LEDGER_SUPABASE_WRITE,
    search: typeof window === 'undefined' ? '' : window.location.search,
  });
}
