# TMS · 팀 KPI 릴리즈 노트

교육팀 TMS와 **팀 KPI 관리**(`module=kpi`) 변경 이력입니다.  
엑셀 운영·시뮬레이터 이력은 `kpi-app-new/docs/CHANGELOG.md` 를 참고하세요.

---

## 2026-07-10 — Add J5 Supabase journal pull with conflict confirm

- 팀장 「Supabase에서 가져오기」로 원격 일지 → 로컬 복구
- 「원격이 더 최신」 안내에서 가져오기 안내로 문구 갱신
- PR #90: https://github.com/cxr542/edu-team-tms/pull/90

## 2026-07-10 — Fix Supabase journal stale-write protection

- Supabase 업무일지 수동 저장이 더 최신 원격 스냅샷을 덮어쓰지 않도록 충돌 검사를 추가했습니다.
- PR #89: https://github.com/cxr542/edu-team-tms/pull/89

## 2026-07-09 — Add J4 journal Supabase freshness UI (read-only)

- 일지 상태 패널에 「원격이 더 최신」 등 Supabase 신선도 힌트 표시 (Preview `MANUAL_MIRROR` + 팀장)
- 가져오기/충돌 복구는 아직 없음 (J5)
- PR #88: https://github.com/cxr542/edu-team-tms/pull/88

## 2026-07-09 — Add PR-merge automation for TMS release notes md

- main 머지 시 참고문서 릴리즈 노트(md)가 PR 제목/`## 릴리즈` 불릿으로 자동 갱신됩니다
- PR 템플릿에 `## 릴리즈` 섹션을 추가했습니다
- PR #87: https://github.com/cxr542/edu-team-tms/pull/87

## 2026-06-17 — ten 파일럿·이전 가이드 보강

- [운영 URL 이전 가이드](./TMS-운영URL-이전-가이드.md) 전면 갱신: localStorage vs Blob, A 파일럿 단계, Safari 검증(`/admin`), Blob 덮어쓰기·용량, B/C 역할(관리자 백업 가져오기)
- [접속 URL · 북마크](./TMS-접속URL-북마크.md) §9 요약 표 정리

## 2026-06-17 — 북마크·기본 origin (`edu-team-tms-ten` 확정)

- **운영 URL 확정:** https://edu-team-tms-ten.vercel.app — §2~§5 북마크·`TMS_ORIGIN` 기본값 정리
- **예비 v2 hostname** `okestro-edu-tms-v2.vercel.app` — 도메인 claim 보류 · 문서에서 미사용 표기
- 참고문서 **「TMS 접속 URL · 북마크」** 전면 갱신

## 2026-06-15 — 새 Vercel·Blob (`edu-team-tms-ten`)

- **운영 URL:** https://edu-team-tms-ten.vercel.app (옛 `okestro-edu-team-tms` 사용 중단)
- **Blob:** 새 스토어 `edu-team-tms-blob` — 일지·향상 과제·장부 수동 팀 공유 재개
- **B/C 일지:** 본인 「팀 공유 저장」·타인 조회용 「팀 공유본 가져오기」(본인 슬라이스 유지)
- **향상 과제:** JSON 대신 Blob 「팀 공유 저장/가져오기」
- **파일럿:** 안정화 전까지 팀장만 새 URL — 구성원은 팀장 안내 후 이전 ([북마크](./TMS-접속URL-북마크.md) §0)

## 2026-06-10 — 구성원 조회용 JSON 가져오기

- B/C 일지 화면에 **「조회용 JSON 가져오기」** 추가 — 팀장이 보낸 백업에서 **타인 일지만** 반영, **본인 일지는 유지**.
- KPI 승인 상태(`kpiApproval`)는 구성원 조회 import 시 반영하지 않음.

## 2026-06-10 — 구성원 일지 A/B/C 탭 조회

- 구성원(B/C)도 일일 업무일지에서 **A · B · C** 탭으로 팀원 일지를 **조회**할 수 있습니다. **본인 탭만** 편집·승인 요청 가능, 타인 탭은 **조회 전용**(`조회` 배지).
- 데이터는 **이 브라우저 localStorage** 기준 — 팀원 PC에는 대개 본인 일지만 저장됩니다. 전체 팀 일지 확인·병합은 팀장 `백업 가져오기` 후 팀장 브라우저에서 합니다.
- 가이드: [TMS 접속 URL · 북마크](./TMS-접속URL-북마크.md), [Blob 중단 — 장부·일지 운영](./TMS-Blob중단-장부일지-운영가이드.md) §6.

## 2026-06-12 — KPI2 향상 과제 JSON 공유 UX 정리

- Vercel Blob 사용량 제한 기간에는 KPI2 향상 과제 공유 UI에서 **JSON 파일 공유**를 전면에 표시하고, 서버 공유 버튼은 숨김 처리했습니다.
- 팀장 화면 문구를 **구성원 전달용 JSON 다운로드** 중심으로, 구성원 화면은 **팀장에게 받은 JSON 가져오기** 중심으로 정리했습니다.

## 2026-06-12 — KPI2 향상 과제 JSON 다운로드/가져오기 fallback

- Vercel Blob 사용량 제한 상황에서도 KPI2 향상 과제 운영 목록을 공유할 수 있도록 **JSON 다운로드/가져오기 fallback**을 추가했습니다.

## 2026-06-12 — KPI2 향상 과제 팀 공유 API hotfix

- KPI2 향상 과제 팀 공유 snapshot API가 서버리스 환경에서 client-only 의존성을 불러오지 않도록 **서버 전용 유틸**로 분리했습니다.

## 2026-06-12 — KPI2 향상 과제 운영 목록 팀 공유 1차

- KPI2 향상 과제 운영 목록을 팀 공유 snapshot으로 **수동 저장/가져오기** 할 수 있는 기반을 추가했습니다. 자동 동기화는 사용하지 않습니다.

## 2026-06-10 — KPI2 운영 목록·구성원 일지 연결 1차

- KPI2 운영 목록에 등록된 생산성향상 과제를 **구성원 일일 업무일지**에서 확인하고, 관련 업무 항목에 연결할 수 있도록 보강했습니다.
- 팀장 KPI2 화면에 향상 과제 **담당/출처** 표시와 브라우저 기준 운영 목록 안내를 추가했습니다.

## 2026-06-12 — 공개 조회 랜딩 축소·역할 URL 정리

- **`member` 없는 `?mode=view`** (루트·`module=ledger`·런치·이것도?·KPI·docs 등) → **역할별 접속 안내 화면**으로 대체. 장부·공개 메뉴 직접 노출 없음.
- **공식 URL 유지:** 팀장 `?mode=edit&access=leader` · 구성원 일지 `?mode=edit&module=journal&member=B|C` · 구성원 장부 조회 `?mode=view&module=ledger&member=B|C&year=2026&month=6`
- snapshot `viewerMenuVisibility` 필드는 호환 유지; **public viewer UI 노출만** 제거.
- 참고문서 **「TMS 접속 URL · 북마크」** 갱신.
- 일일 업무일지 화면에 **로컬 저장/팀 공유 저장 안내**와 **M/M·KPI2 효과 설명**을 보강했습니다.
- 생산성향상 도구/과제 관리 화면에서 **후보, 운영 목록, KPI2 효과 제출** 의미를 더 명확히 안내했습니다.
- KPI2/생산성향상 상세 화면에 **구성원 개요로 돌아가기** 버튼과 KPI2 안내 문구를 보강했습니다.

## 2026-06-11 — Blob 트래픽 절감·구성원 운영·배포 복구

**대표 운영 URL:** https://okestro-edu-team-tms.vercel.app
(보조 alias: https://edu-team-tms.vercel.app — 동일 콘텐츠)

### 구성원 기능·운영 반영

- 구성원(B/C) 일지·역량·클라우드 동기화 등 **CBT 운영 반영** (2026-06-10 전후 배포)
- 공유 일지 **import** 시 원격 스냅샷 병합 개선
- 분기 역량 자체평가 문구 정리

### API·배포

- **KPI operational snapshot** API ESM import 500 → **200** 핫픽스 (`0fc5445`)
- GitHub Actions **VERCEL_TOKEN** 갱신 후 자동 production 배포 **복구**
- Blob snapshot이 비어 있는 동안에도 팀 빌딩비 조회가 가능하도록 백업 기반 정적 `ledger-snapshot.json` fallback을 복구했습니다. 이 데이터는 배포 시점의 백업 기준(2026-06-09)이며, 실시간 cloud snapshot은 아닙니다.
- 팀 빌딩비 관리 정적 조회 snapshot을 팀장 브라우저의 최신 백업 기준으로 갱신했습니다. 기존 2026-06-09 백업(60건)에서 **2026-06-11** 데이터 포함 snapshot(62건, `publishedAt` 2026-06-11)으로 교체했습니다.

### Blob P0 핫픽스 (`af0dfeb`)

Vercel Blob 무료 한도(Simple/Advanced 100%) 대응:

- **장부 조회 snapshot 자동 폴링 제거** — 장부 화면 진입 시 1회 + 「새로고침」 수동만
- **일지 cloud 자동 pull/save 제거** — 「공유 일지 가져오기」·「공유 저장」 버튼만
- **Cloud Health / Quota Guard** — quota·pause 의심 시 5분 쓰기 cooldown + 안내
- **ledger legacy `list` fallback 제거** — `live-latest.json` + 정적 폴백만
- **장부 snapshot API** — `ledger/live-latest.json` 또는 정적 snapshot이 없으면 `404 snapshot not found` (cloud snapshot 부재, 앱 로드 실패 아님)
- **dev production snapshot proxy** — `VITE_PROD_SNAPSHOT_PROXY=true` 일 때만 opt-in

### 사용자 영향

- **브라우저 localStorage** 일지·KPI·장부 작성은 **계속 가능**
- 팀 **공유·조회 URL 반영**은 **수동 버튼** 중심 (자동 동기화 없음)
- 조회(장부) 화면은 **자동 갱신되지 않음** — 필요 시 「새로고침」
- Blob **제한·pause** 상태에서는 cloud 공유·조회 반영 **실패 가능** (로컬 저장은 유지)

### 후속 (별도 승인)

- Blob Storage 75% · 레거시 `ledger/live-*` **cleanup**
- KPI2 탭 발견성·향상 과제 안내·M/M 완료 체크 UX
- Jira 1~5월 일지 이관

## 2026-06-05 — 역량·메뉴·접속 URL

- **역량 평가**: 구성원별 전용 페이지 (`?member=`), 4탭(레벨·다면·리더·실전)
- **팀원 메뉴**: 팀 공통(장부 조회·점심·이것도?) · 실험 버전은 **팀장 전용**
- **승인 요청**: 일지에서 KPI1/KPI2 팀장 승인 큐 연동
- **KPI 리포트**: 월 선택·등급 기준 접기
- **참고문서**: 사이드바 **「TMS 접속 URL · 북마크」** 추가 (구성원별 운영 URL)

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

1. `docs/reference-source/*.md` 수정 (또는 main 머지 시 `release-notes-on-merge`가 PR 제목/`## 릴리즈` 불릿을 자동 prepend)
2. `npm run sync:docs` (또는 `build:team` 시 자동; 자동화 워크플로도 sync 실행)
3. GitHub Actions로 배포 (main 머지 → production 승인)
