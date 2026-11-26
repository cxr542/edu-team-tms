/**
 * 관리자 「루틴 자동화」 카드 목록.
 * `live: true` 인 루틴만 실제 실행기(runner)가 연결돼 있다.
 *  - 읽기 전용(readOnly) 점검, 또는
 *  - 데이터를 바꾸는 루틴: 서버 미리보기(preview)와 되돌리기(undoable)가 모두 있어야 한다.
 * 나머지는 실행 흐름(미리보기 → 확인 → 실행 → 결과)만 보여 주는 데모이며 어떤 데이터도 바꾸지 않는다.
 * 데이터를 바꾸는 루틴을 live 로 바꾸려면 별도 승인이 필요하다(AGENTS.md).
 */

/** 실행 위치 */
export const AUTOMATION_WHERE = {
  server: '서버',
  browser: '브라우저',
  pc: '내 PC',
};

export const AUTOMATION_GROUPS = [
  {
    id: 'tms',
    title: 'TMS 데이터 정리',
    hint: '서버·브라우저에서 실행',
    routines: [
      {
        id: 'announcements-archive',
        emoji: '📣',
        title: '오래된 공지 보관 처리',
        description: '게시한 지 90일 지난 공지(고정 제외)를 게시 해제합니다. 삭제하지 않으며 되돌릴 수 있습니다.',
        where: 'server',
        live: true,
        runner: 'announcementArchive',
        undoable: true,
      },
      {
        id: 'browser-cache',
        emoji: '🧹',
        title: '브라우저 임시 캐시 비우기',
        description: '이 브라우저의 오래된 임시 초안·캐시 키를 정리합니다. 일지·장부는 건드리지 않습니다.',
        where: 'browser',
        preview: ['임시 초안 키 12개', '일지·KPI·장부 키는 제외'],
        resultLabel: '12개 키',
      },
      {
        id: 'csr-close',
        emoji: '✅',
        title: '처리 완료 CSR 요청 마감',
        description: '답변이 끝난 지 30일 지난 요청을 닫힘 상태로 바꿉니다.',
        where: 'server',
        preview: ['완료 후 30일 경과 7건 → 닫힘'],
        resultLabel: '7건',
      },
      {
        id: 'release-note-check',
        emoji: '📝',
        title: '릴리즈노트 누락분 점검',
        description: '머지된 PR 중 릴리즈노트에 빠진 항목을 찾아 알려 줍니다. (읽기 전용)',
        where: 'server',
        readOnly: true,
        live: true,
        runner: 'releaseNoteCheck',
        resultLabel: '누락 0건',
      },
    ],
  },
  {
    id: 'mail',
    title: '메일 · 메신저',
    hint: '내 PC 에이전트가 실행',
    routines: [
      {
        id: 'mail-mark-read',
        emoji: '✉️',
        title: '읽지 않은 메일 읽음 처리',
        description: '뉴스레터·알림 등 중요하지 않은 발신자의 읽지 않은 메일을 읽음으로 바꿉니다.',
        where: 'pc',
        preview: ['알림·뉴스레터 63건 → 읽음', '받은편지함 이동·삭제 없음', 'VIP·팀원 발신 메일은 제외'],
        resultLabel: '63건',
      },
      {
        id: 'bot-notice-read',
        emoji: '💬',
        title: '오래된 알림 정리',
        description: '7일 지난 봇 알림 메시지를 읽음 처리합니다.',
        where: 'pc',
        preview: ['봇 알림 21건 → 읽음'],
        resultLabel: '21건',
      },
    ],
  },
  {
    id: 'pc',
    title: '내 컴퓨터',
    hint: '내 PC 에이전트가 실행',
    routines: [
      {
        id: 'desktop-tidy',
        emoji: '🗂️',
        title: '바탕화면 정리',
        description: '바탕화면 파일을 종류별 폴더로 옮깁니다. 삭제하지 않습니다.',
        where: 'pc',
        preview: [
          '스크린샷 11개 → 사진/스크린샷',
          '문서 5개 → 문서/정리됨',
          '기타 2개 → 정리됨/기타',
          '삭제되는 파일 0개',
        ],
        resultLabel: '18개 이동',
      },
      {
        id: 'downloads-tidy',
        emoji: '⬇️',
        title: '다운로드 폴더 오래된 파일 이동',
        description: '30일 지난 파일을 「정리됨」 폴더로 이동합니다.',
        where: 'pc',
        preview: ['30일 경과 파일 34개 → 정리됨/월별 폴더'],
        resultLabel: '34개 이동',
      },
    ],
  },
];

export function listAutomationRoutines() {
  return AUTOMATION_GROUPS.flatMap((g) => g.routines);
}
