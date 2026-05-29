import { TMS_EDIT_URL, TMS_VIEW_URL } from './appUrls';

/** iPhone 메모·붙여넣기용 (Safari 필수 안내 포함) */
export const IPHONE_HOME_SCREEN_MEMO = `[나중에] iPhone — 교육팀 TMS 홈 화면

※ iPhone은 Safari로만 「홈 화면에 추가」 됩니다.
   (Chrome·카톡 인앱 브라우저는 비권장)

■ 조회용
1. Safari에서 열기:
${TMS_VIEW_URL}
2. 공유(□↑) → 홈 화면에 추가
3. 이름: 교육팀 장부

■ 편집용 (팀장)
1. Safari에서 열기:
${TMS_EDIT_URL}
2. 공유 → 홈 화면에 추가
3. 이름: TMS 편집

Android: Chrome → 홈 화면에 추가`;
