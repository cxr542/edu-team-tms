# DESIGN.md — EDU-TMS Product and System Design

## 1. Purpose and Scope
EDU-TMS는 OKESTRO 교육팀의 운영 관리 시스템이다. 팀/구성원 일지, KPI, ledger, improve-project 추적, 참고문서를 한 곳에서 다룬다.

이 문서는 EDU-TMS의 제품/시스템 설계 문서다. AI/Codex 작업 규칙은 `AGENTS.md`를 따른다. 문서의 Source of Truth 배치는 `docs/sot-map.md`를 따른다.

## 2. Product Context
EDU-TMS는 팀장이 구성원 작업 흐름을 확인하고, 구성원은 자기 일지와 개선 과제를 기록하는 내부 운영 도구다.

핵심 맥락은 다음과 같다.
- 주간 업무일지와 KPI 연계
- KPI2 생산성향상 과제 관리
- ledger snapshot 기반 운영
- 문서형 참고자료와 운영 URL 관리
- 브라우저별 localStorage와 공용 JSON fallback의 병행

## 3. User Roles and Access Model
주요 역할은 leader와 member다.

- leader 모드: 팀장, 총무, 관리자 역할을 겸한다.
- member 모드: 일반 구성원이다.

대표 URL은 다음과 같다.
- Production: `https://edu-team-tms-ten.vercel.app`
- Admin URL: `https://edu-team-tms-ten.vercel.app/admin`
- Journal example: `https://edu-team-tms-ten.vercel.app/yhkim?year=2026&month=6`

leader/member 차이는 주로 편집 권한, 공유 JSON 처리, 문서/일지 진입점 안내, KPI 운영 화면에서의 가시성에 반영된다.

브라우저별 localStorage는 공유 저장소가 아니므로, 같은 URL이라도 기기나 origin이 다르면 상태가 달라질 수 있다.

## 4. URL and Query Parameter Model
현재 운영에서 중요한 query parameter는 다음과 같다.

- `mode`: 조회/편집 같은 UI 모드
- `access`: leader/member 접근 구분
- `member`: A/B/C 같은 구성원 코드
- `module`: journal, kpi, docs 등 모듈 선택
- `doc`: 참고문서 식별자
- `year`: 일지/주기 기준 연도
- `month`: 일지/주기 기준 월

URL/access 규칙의 기준 문서는 `docs/reference-source/TMS-접속URL-북마크.md`다. 이 문서가 실제 운영 진입점과 역할별 URL의 SoT다.

## 5. Core Screens and Modules
EDU-TMS의 주요 화면은 다음과 같다.

- Member Overview
  - 구성원별 운영 진입점
  - 현재 상태와 빠른 이동의 출발점
- Weekly Journal
  - 주간 업무일지 작성/조회
  - member별 브라우저 캐시와 공용 snapshot을 함께 고려
- Team KPI
  - 팀 KPI 관찰/승인/보고
  - 일지와 개선 과제의 집계 흐름을 연결
- KPI2 Improve Projects
  - 생산성향상 과제 관리
  - journal에서 올라온 후보, 운영 중 과제, 제출/소유 정보 표시
- Reference Docs
  - 문서형 참고자료 조회
  - 정적 문서와 운영 문서의 경계를 유지
- Ledger/static snapshot views
  - ledger snapshot과 공용 JSON fallback을 읽는 표면

KPI2는 특히 다음 흐름을 가진다.
- journal에서 후보가 올라올 수 있다
- 운영 중인 생산성향상 도구/과제를 함께 볼 수 있다
- 효과 제출 관리가 필요하다
- 소유자와 출처를 확인할 수 있어야 한다

## 6. Data Flow Overview
고수준 데이터 흐름은 다음과 같다.

1. 구성원은 journal, KPI, improve-project 화면에서 입력한다.
2. 기본 저장은 브라우저 localStorage에 남는다.
3. 공유가 필요한 경우 공용 JSON fallback 또는 snapshot을 읽는다.
4. ledger/journal/improve-projects는 서로 연결되지만 같은 저장소가 아니다.
5. Blob 공유는 현재 비활성 상태다.

중요한 점은 다음과 같다.
- localStorage가 비어 있다고 해서 운영 데이터가 사라진 것은 아닐 수 있다.
- 운영 데이터와 브라우저 캐시는 분리해서 본다.
- 공용 JSON은 현재 허용된 fallback 경로다.
- Blob 기반 improve-project 공유는 비활성 상태로 유지한다.

## 7. Storage Model
저장 방식은 목적이 다르다.

### localStorage
- 목적: 개인 브라우저의 임시/캐시 상태
- 쓰기 규칙: 화면 편집 시 즉시 반영될 수 있음
- 위험: 다른 브라우저나 다른 origin과 공유되지 않음

### static JSON
- 목적: 공용 읽기용 fallback 또는 배포용 스냅샷
- 쓰기 규칙: 배포/동기화 절차를 거쳐 반영
- 위험: 생성물과 소스 문서를 혼동하기 쉬움

### Vercel Blob
- 목적: 과거 또는 제한적 공용 저장 경로
- 현재 상태: improve-project sharing에서는 비활성
- 쓰기 규칙: 승인 없이는 사용하지 않음
- 위험: 재노출되면 운영 정책 위반으로 본다

### docs/docs-graph.json
- 목적: 문서 관계를 추출한 PoC 산출물
- 쓰기 규칙: 생성 결과를 커밋할 수 있지만, generatedAt만 변한 재생성은 커밋하지 않는다
- 위험: 운영 데이터가 아니라 분석 산출물로 봐야 한다

## 8. Improve Projects and JSON Fallback Sharing
improve-project 공유는 현재 JSON fallback 중심이다.

- Blob sharing UI는 숨김/비활성 상태다.
- `IMPROVE_PROJECT_BLOB_SHARE_ENABLED = true` — KPI2 향상 과제는 Blob 팀 공유(수동 저장/가져오기).
- leader 흐름은 JSON 다운로드와 가져오기를 사용한다.
- member 흐름은 팀장에게 받은 JSON 가져오기를 사용한다.
- journal task와 improve-project 간 연결은 유지하되, Blob 공유가 활성화된 것처럼 설명하지 않는다.

운영상 중요한 것은 다음이다.
- JSON fallback은 허용된다.
- Blob write/delete/POST는 승인 없이 하지 않는다.
- Blob 버튼이 다시 보이면 regression으로 본다.

## 9. Ledger and Journal Safety
ledger와 journal은 운영 데이터다. 브라우저마다 localStorage가 다를 수 있으므로, 로컬에 보이지 않는다고 해서 데이터가 없는 것은 아니다.

설계상 중요한 점은 다음과 같다.
- static ledger snapshot은 읽기용 기준점 역할을 한다.
- journal은 member와 기간(year/month)에 따라 달라질 수 있다.
- ledger/journal write는 운영상 민감하므로 승인 없이 수행하지 않는다.
- 데이터 유실 방지를 우선한다.

## 10. Documentation and Source of Truth
문서 체계는 다음처럼 구분한다.

- `docs/reference-source/*`
  - 주요 원본 참고문서
- `public/docs/*`
  - 배포용 복제본
- `.vercel/output/static/*`
  - 빌드 산출물
- `docs/sot-map.md`
  - 어떤 문서를 무엇의 기준으로 볼지 정리한 지도
- `AGENTS.md`
  - AI/Codex 작업 규칙과 금지사항

`public/docs/*`와 `.vercel/output/static/*`는 소스 문서가 아니다. 기준 문서와 복제본을 구분해야 한다.

## 11. Docs Graph and Obsidian PoC
EDU-TMS 문서는 Obsidian Vault처럼 탐색할 수 있고, graph JSON은 기계가 분석하는 관계 지도다.

관련 파일은 다음과 같다.
- `docs/obsidian-graph-poc.md`
- `scripts/extract-docs-graph.mjs`
- `scripts/docs-graph-core.mjs`
- `docs/docs-graph.json`

이 PoC의 목적은 문서 간 관계, SoT 충돌, URL 중복, 위험 키워드, 복제 관계를 탐지하는 것이다. `docs/docs-graph.json`은 PoC 산출물이며, `generatedAt`만 바뀐 재생성은 커밋 대상이 아니다.

## 12. Deployment and Operations
운영 배포는 Vercel production deployment를 따른다.

- push는 자동 배포를 유발할 수 있다.
- 수동 deploy는 정상 운영 흐름이 아니다.
- 배포 절차의 기준은 `docs/deployment-process.md`다.
- production URL 확인은 배포 후 운영 상태를 보는 용도다.

## 13. Safety Boundaries
다음은 승인 없이 하지 않는다.

- 운영 데이터 수정
- ledger/journal JSON 수정
- Blob write/delete/POST
- public/docs를 원본처럼 수정
- `.vercel/output/static`를 소스처럼 수정
- 수동 deploy

세부 금지와 작업 규칙은 `AGENTS.md`를 따른다. 이 문서는 설계 문서이므로 작업 금지를 길게 복붙하지 않는다.

## 14. Visual Design Notes
이 섹션은 EDU-TMS의 기본 화면 톤을 보조적으로 정리한다.

- 정보 중심의 내부 운영 도구 톤을 유지한다.
- 과장된 장식보다 읽기 쉬운 구조를 우선한다.
- 제목, 표, 카드, 탭, 상태 배지를 일관되게 쓴다.
- 모바일과 데스크톱에서 텍스트가 겹치지 않도록 한다.
- 버튼과 카드의 크기, 간격, 정렬은 안정적으로 유지한다.
- 기존 시각 가이드를 참고하되, 제품/시스템 설계보다 앞세우지 않는다.

## 15. Okestro Design System
OKESTRO 전사 가이드 PPT 템플릿(2024)에서 역설계한 하우스 디자인 시스템(`Okestro Design System.zip`)을 EDU-TMS 화면의 시각 기준으로 삼는다. 원본 zip(약 52MB, 폰트·아이콘 367개·슬라이드 샘플 포함)은 저장소에 넣지 않고, 화면에 쓰는 토큰과 규칙만 이 문서와 `src/styles/okestroTokens.css`에 옮긴다. 토큰은 기존 앱 토큰(`--primary`, `--text-muted` 등)과 충돌하지 않도록 `--ok-` 접두사를 쓴다.

### 15.1 적용 범위와 한계
- 원본은 **덱(PPT) 시스템**이다. 제품 UI 킷은 없고, 화면용 값(화면 타입 스케일, 4/8px 라디우스, 모션)은 원본이 `inferred`로 표시한 추론이다.
- 현재 적용: 메인(접속 안내) 화면 `PublicViewerGuidePage` (`src/pages/PublicViewerGuidePage.css`).
- 그 외 화면(장부, 일지, KPI 등)은 기존 스타일을 유지한다. 점진적으로 옮기며, 화면을 옮길 때마다 이 절에 적용 범위를 갱신한다.

### 15.2 색
| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--ok-navy` | `#000080` | 대표색. 라벨, 표 헤더, 강조 텍스트, 카드 hover 보더 |
| `--ok-blue` | `#1038ED` | 링크, 활성, 페이지 번호, 포커스 링, 솔리드 CTA |
| `--ok-blue-light` | `#1D80F8` | 보조 시리즈 |
| `--ok-grey-100` | `#F5F5F5` | 캔버스(페이지 바탕), 회색 면 |
| `--ok-grey-200` | `#E9E9E9` | 헤어라인, 표 괘선 |
| `--ok-grey-900` | `#1A2430` | 본문 텍스트, 어두운 밴드 |
| `--ok-text-muted` | `#5B5B6F` | 캡션, 보조 설명 |
| `--ok-point-orange` | `#F15928` | 포인트색, 에러 상태 |
| `--ok-point-green/teal/purple` | `#32CD32` / `#00BDAA` / `#9659B9` | 포인트색 후보 |

- Neutral이 표면의 대부분이다. 흰색 또는 `#F5F5F5` 바탕, 본문은 진한 색(연한 회색 본문 금지).
- 포인트색은 **화면당 1색, 표면의 10% 이내**.
- 전용 빨강이 없다. 에러·위험 표시도 `--ok-point-orange`.
- 링크 `#1038ED`, 방문 링크 `#78788C`.

### 15.3 타입
- Pretendard 단일 서체. 실사용 웨이트는 400 / 600 / 700 / 800.
- 전부 좌측 정렬(가운데 정렬은 표 셀과 페이지 번호만). 이탤릭 없음, 레터스페이싱 트릭 없음.
- 화면 스케일(추론): 32 / 24 / 20 / 16 / 14 / 12px. 중간값을 만들지 않는다.
- 행간: 제목 1.1 안팎, 한글 본문 1.7.

### 15.4 모양·간격·모션
- 라디우스는 **20px 아니면 0**. 카드는 20px, 버튼·칩·배지·입력은 0.
- 보더는 1px `#E9E9E9` 헤어라인. **드롭섀도·블러·반투명·그라디언트 장식 없음.** 깊이는 `#F5F5F5` 위의 흰 면과 헤어라인으로 만든다.
- 표는 수평 괘선만 쓰고 세로선은 없다. 헤더 행은 솔리드 네이비.
- 간격 스케일: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64.
- 모션: 120~200ms, `cubic-bezier(.4,0,.2,1)`, 투명도와 작은 이동만. 바운스·스프링·패럴랙스 금지.
- 상태: hover = 솔리드 필은 네이비 방향으로 어둡게, 아웃라인은 회색 면으로 / press = scale 변환 없음 / disabled = 같은 색 38% 투명도 / focus = 2px `#1038ED` 링 / error = `--ok-point-orange`.

### 15.5 콘텐츠 톤
- 한국어 우선, 격식체 + 마침표. 영어는 구조 라벨에만 쓴다(`Team Access`, `Admin`).
- 카테고리 라벨은 영어 + 공백 + 한글 풀이 순서(`Education 교육`).
- 번호 구조는 `1. 제목`, 하위는 `1.1`. 금액은 `100,000원`, 범위는 공백 있는 `~`.
- **이모지 금지.** 아이콘은 아웃라인 전용(현재 앱은 lucide-react 사용).
- 인칭 표현("저희", "여러분")을 쓰지 않는다.

### 15.6 로고·에셋
- 워드마크는 항상 대문자 `OKESTRO`. 바탕 밝기에 맞는 세트(흰색/네이비)를 고르고 리컬러·재작도는 금지.
- 원본 zip의 `assets/logo-*`, `assets/fonts/Pretendard-*.otf`, `assets/icons/*`는 필요할 때 zip에서 꺼내 쓴다. 현재 앱은 기존 로고와 Pretendard를 그대로 쓴다.

### 15.7 변경 이력
- 2026-11-26: 디자인 시스템 규칙을 DESIGN.md에 반영하고 `okestroTokens.css`를 추가했다. 메인(접속 안내) 화면에 먼저 적용했다.
- 2026-11-26: 메인 화면을 좌 안내 + 우 목록 레이아웃으로 정리했다(`pv-` 클래스, `src/pages/PublicViewerGuidePage.*`). 옛 `public-viewer-portal` 스타일은 `src/index.css`에서 제거했다.
