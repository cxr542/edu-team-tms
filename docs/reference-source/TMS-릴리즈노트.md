# TMS · 팀 KPI 릴리즈 노트

교육팀 TMS와 **팀 KPI 관리**(`module=kpi`) 변경 이력입니다.  
엑셀 운영·시뮬레이터 이력은 `kpi-app-new/docs/CHANGELOG.md` 를 참고하세요.

---

## 2026-06-05 — 역량·메뉴·접속 URL

- **역량 평가**: 구성원별 전용 페이지 (`?member=`), 4탭(레벨·다면·리더·실전)
- **팀원 메뉴**: 팀 공통(장부 조회·점심·이것도?) · 실험 버전은 **팀장 전용**
- **승인 요청**: 일지에서 KPI1/KPI2 팀장 승인 큐 연동
- **KPI 리포트**: 월 선택·등급 기준 접기
- **참고문서**: [TMS 접속 URL · 북마크](./TMS-접속URL-북마크.md) 추가

## 2026-06-02 — 오늘 뭐 먹지

- 사이드바 **오늘 뭐 먹지** (`module=lunch`, edit 모드만)
- 기준 위치 **오케스트로(파크원타워2)** 기본, 프리셋·직접 지정 변경 (`tms-lunch-origin-v1`)
- 단골 맛집 JSON + **등록** 탭·검색 결과 단골 추가 (`tms-lunch-custom-spots-v1`)
- 필터·추천·방문 기록(localStorage), 식대 13,000원 기준
- 카카오 로컬 API 검색 (`KAKAO_REST_API_KEY`, `api/kakao-local.js`)

## 2026-06-02 — PPT 아카데미화·정의서 v5

- 사이드바 **PPT 아카데미화** (`module=academizer`, edit 모드만) — TMS iframe 내장
- 참고문서 **세로 스크롤** 개선
- KPI 정의서: OneDrive `교육팀_KPI_정의서_최종v5.docx` 추출 반영
- KPI3 가중(다면 15%)·등급 컷(4.3/4.0/3.8/3.5) TMS 계산 동기

## 2026-06-02 — 참고문서·UI

- 사이드바 **참고문서** 메뉴 (`module=docs`)
- **교육팀 KPI 정의서** 원문·TMS 운영 가이드·릴리즈 노트 브라우징
- 팀 KPI 화면 우하단 **정의서** 바로가기
- 일지 상단 KPI 연계 대형 배너 제거 (가이드는 참고문서로 이전)

## 2026-06 — TMS KPI v2 (SoT)

- **공식 기록 = TMS**, 엑셀은 분석 export만
- KPI 표시명: 업무 리소스 가동률 / 생산성 / 교육팀 핵심 역량 레벨
- 일지 연동 · 월 확정 · 제출/승인 · KPI2 효과 건
- `team-kpi-snapshot.json` · 분석 Excel 패키지
- Academizer 시나리오 샘플 일지

## 2026-05 — 엑셀·시뮬레이터 (kpi-app-new)

- KPI 운영 엑셀 8시트 구조, 01c 주간메모
- 웹 시뮬레이터 v1.0 (KPI1·KPI2 체험)

---

### 문서 수정 방법

1. `docs/reference-source/*.md` 수정
2. `npm run sync:docs` (또는 `build:team` 시 자동)
3. GitHub Actions로 배포 (main 머지 → production 승인)
