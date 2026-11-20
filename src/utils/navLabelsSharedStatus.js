/** 팀 공유 저장 상태를 사람이 읽는 문장으로 */
export function describeSharedStatus(shared) {
  const status = shared?.status || 'idle';
  const stamp = shared?.at ? ` (${new Date(shared.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})` : '';
  if (status === 'idle' || status === 'loading') return { tone: 'muted', text: '팀 공유 설정을 불러오는 중…' };
  if (status === 'saving') return { tone: 'muted', text: '팀 공유 저장 중…' };
  if (status === 'saved') return { tone: 'ok', text: `팀 공유로 저장됐어요${stamp}. 다른 관리자 브라우저에도 같게 보여요.` };
  if (status === 'ready') return { tone: 'ok', text: `팀 공유 설정을 불러왔어요${stamp}. 바꾸면 모든 관리자 브라우저에 적용돼요.` };
  if (status === 'empty') return { tone: 'muted', text: '아직 공유된 설정이 없어요. 바꾸면 팀 공유로 저장돼요.' };
  if (status === 'not-ready') return { tone: 'warn', text: '팀 공유 저장소가 아직 준비되지 않아 이 브라우저에만 저장돼요. (관리자에게 문의)' };
  return { tone: 'warn', text: `팀 공유 저장에 실패해 이 브라우저에만 저장됐어요${shared?.message ? ` (${shared.message})` : ''}.` };
}
