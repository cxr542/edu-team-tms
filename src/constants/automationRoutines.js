/**
 * 관리자 「루틴 자동화」 카드 목록.
 * `live: true` 인 루틴만 실제 실행기(runner)가 연결돼 있다.
 *  - 읽기 전용(readOnly) 점검, 또는
 *  - 데이터를 바꾸는 루틴: 서버 미리보기(preview)와 되돌리기(undoable)가 모두 있어야 한다.
 * `link` 루틴은 실행 없이 주소만 새 탭으로 여는 바로가기다(이 PC 로컬 주소 전용).
 * `prompt` 루틴은 웹에서 실행할 수 없는 내 PC 일을 에이전트(Claude 등)에게 붙여 넣을 요청문으로 복사한다.
 *   요청문은 대상 목록을 먼저 보여 주고 확인을 받으며 삭제하지 않도록 쓴다.
 * 위에 해당하지 않는 루틴은 실행 흐름만 보여 주는 데모이며 어떤 데이터도 바꾸지 않는다(지금은 없음).
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
        description: '게시한 지 90일 지난 공지(릴리즈노트 분류·고정 제외)를 게시 해제합니다. 삭제하지 않으며 되돌릴 수 있습니다.',
        where: 'server',
        live: true,
        runner: 'announcementArchive',
        undoable: true,
      },
      {
        id: 'browser-cache',
        emoji: '🧹',
        title: '브라우저 임시 캐시 비우기',
        description:
          '이 브라우저 탭의 다시 만들어지는 임시 캐시(카카오 장소 검색, 점심 「오늘 제외」)만 지웁니다. 일지·장부·KPI·설정은 건드리지 않습니다.',
        where: 'browser',
        live: true,
        runner: 'browserCache',
        undoable: true,
      },
      {
        id: 'csr-stale-check',
        emoji: '✅',
        title: '오래 처리 안 된 CSR 점검',
        description: '접수·진행 중인 채로 30일 넘게 갱신되지 않은 요청을 찾아 알려 줍니다. (읽기 전용)',
        where: 'server',
        readOnly: true,
        live: true,
        runner: 'csrStaleCheck',
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
        description: '뉴스레터·알림 등 중요하지 않은 발신자의 읽지 않은 메일을 읽음으로 바꾸도록 에이전트에게 시킬 요청문을 복사합니다.',
        where: 'pc',
        prompt: {
          label: '요청문 복사',
          text:
            '내 받은편지함에서 읽지 않은 메일 중 뉴스레터·시스템 알림 같은 중요하지 않은 발신자의 메일만 읽음 처리해 줘. 팀원과 상사가 보낸 메일은 제외해. 받은편지함 이동과 삭제는 하지 마. 먼저 대상 목록만 보여 주고, 내가 확인한다고 답한 뒤에만 처리해 줘. 삭제는 절대 하지 말고 되돌릴 수 있게 해 줘. 대상은 발신자별 건수와 대표 제목으로 보여 줘.',
        },
      },
      {
        id: 'bot-notice-read',
        emoji: '💬',
        title: '오래된 알림 정리',
        description: '7일 지난 봇 알림 메시지를 읽음 처리하도록 에이전트에게 시킬 요청문을 복사합니다.',
        where: 'pc',
        prompt: {
          label: '요청문 복사',
          text:
            'Teams·메신저에서 7일 지난 봇(자동 알림) 메시지만 읽음 처리해 줘. 사람이 보낸 메시지는 건드리지 마. 메시지 삭제는 하지 마. 먼저 대상 목록만 보여 주고, 내가 확인한다고 답한 뒤에만 처리해 줘. 삭제는 절대 하지 말고 되돌릴 수 있게 해 줘. 대상은 채널별 건수로 보여 줘.',
        },
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
        description: '바탕화면 파일을 종류별 폴더로 옮기도록 에이전트에게 시킬 요청문을 복사합니다. 삭제하지 않습니다.',
        where: 'pc',
        prompt: {
          label: '요청문 복사',
          text:
            '내 바탕화면(~/Desktop)의 파일을 종류별 폴더(스크린샷, 문서, 기타)로 옮겨 정리해 줘. 폴더와 바로가기, 이름에 『정리됨』이 있는 항목은 건드리지 마. 파일 삭제와 덮어쓰기는 하지 마. 먼저 대상 목록만 보여 주고, 내가 확인한다고 답한 뒤에만 처리해 줘. 삭제는 절대 하지 말고 되돌릴 수 있게 해 줘. 대상은 「파일 → 옮길 폴더」 표로 보여 줘.',
        },
      },
      {
        id: 'downloads-tidy',
        emoji: '⬇️',
        title: '다운로드 폴더 오래된 파일 이동',
        description: '30일 지난 다운로드 파일을 「정리됨」 폴더로 옮기도록 에이전트에게 시킬 요청문을 복사합니다.',
        where: 'pc',
        prompt: {
          label: '요청문 복사',
          text:
            '내 다운로드 폴더(~/Downloads)에서 마지막 수정이 30일 지난 파일만 ~/Downloads/정리됨/YYYY-MM 폴더로 옮겨 줘. 폴더와 최근 30일 안의 파일은 건드리지 마. 파일 삭제와 덮어쓰기는 하지 마. 먼저 대상 목록만 보여 주고, 내가 확인한다고 답한 뒤에만 처리해 줘. 삭제는 절대 하지 말고 되돌릴 수 있게 해 줘. 대상은 「파일 → 옮길 폴더」 표로 보여 줘.',
        },
      },
      {
        id: 'barndog-open',
        emoji: '🐶',
        title: 'BarnDog 관리 열기',
        description:
          '코딩 도구에 스킬·MCP를 설치·연결하는 내 PC 관리 화면을 새 탭으로 엽니다. 이 PC에서 BarnDog가 켜져 있을 때만 열립니다.',
        where: 'pc',
        link: { href: 'http://127.0.0.1:4747/', label: '열기' },
      },
    ],
  },
];

export function listAutomationRoutines() {
  return AUTOMATION_GROUPS.flatMap((g) => g.routines);
}
