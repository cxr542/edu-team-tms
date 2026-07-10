# EDU-TMS 운영 백로그

이 문서는 현재 운영에서 확인된 후속 개선사항과 대기 중인 작업을 정리한다.

운영 URL: https://edu-team-tms-ten.vercel.app/admin

## 1. 공지사항 / 릴리즈노트 (PR #64)

- **상태:** 코드 main 머지·Production 배포 완료 (`27bbfaf`, 2026-07-06)
- **운영 DB:** `phase0-apply.sql` 적용 완료 (2026-07-06) — 공지 RLS 보강 후 재적용 필요
- **QA:** Supabase 점검 정상, 공지 페이지 오류 없음 확인
- **남은 운영 QA:** 공지 등록·게시·구성원 노출 end-to-end (§5)

## 2. CSR 게시판 후속 개선

현재 CSR 게시판은 동작하지만 운영 관점에서 다음 개선 여지가 있다.

- 요청 상세 보기 개선
- 상태 변경 이력 기록
- 관리자 답변 알림
- 카테고리/상태 필터
- 처리 완료일 표시
- 담당자 표시
- 불가 사유를 더 명확하게 노출

## 3. KPI / 업무일지 후속 개선

KPI1 계산 기준은 안정화 메모를 남기고, 주차 완료 M/M 정렬 기준은 현재 완료 task 기준으로 유지한다.

추가로 검토할 수 있는 UX 개선사항:

- KPI1 계산 기준을 화면에서 더 명확하게 설명
- 완료 task 기준 정렬 규칙을 안내 문구로 노출
- 업무일지와 KPI 연결 상태를 더 직관적으로 보여주기
- 운영자가 변경 근거를 쉽게 확인할 수 있도록 보조 설명 보강

## 4. 공지사항 / 릴리즈노트 운영 계획

공지사항 UI는 릴리즈노트형 타임라인 피드로 운영한다. 사용자 대면 변경 안내는 **공지(`release` 기본)** 에 등록하고, `docs/reference-source/TMS-릴리즈노트.md` 누적 이력은 **main 머지 시 자동 prepend**(`release-notes-on-merge.yml`)하며 수동 보강도 가능하다. Deploy 재트리거를 위해 repo secret `RELEASE_NOTES_PUSH_TOKEN`(PAT)을 권장한다(`GITHUB_TOKEN`만 쓰면 문서 커밋은 되지만 Deploy가 자동 시작되지 않음).

카테고리:

- `release`: 업데이트 내역 (신규 작성 기본)
- `notice`: 일반 공지
- `incident`: 장애 안내
- `guide`: 사용 안내

운영 기준:

- `is_pinned = true` 인 공지는 상단 우선 노출
- `is_published = true` 인 공지만 구성원에게 노출
- 관리자/팀장은 전체 공지 조회 및 수정 가능
- 구성원은 공개 공지만 조회 가능
- 전체 이력 문서는 공지 헤더의 「참고문서 릴리즈 노트」 링크 (`?module=docs&doc=tms-release`)
## 5. 운영 QA 체크리스트

공지사항/릴리즈노트 배포 후 아래를 확인한다.

- 구성원 화면에서 공개 공지만 보이는지 확인
- 관리자 화면에서 공지 등록/수정이 가능한지 확인
- Supabase `announcements` 테이블에 저장되는지 확인
- 새로고침 후에도 목록이 유지되는지 확인
- Production URL (`edu-team-tms-ten.vercel.app`) 반영 여부 확인

## 6. 우선순위 메모

**정책 (2026-07-07): Supabase 전환은 업무일지 우선.** 공지·CSR·Lunch v2는 일지 파일럿이 끝날 때까지 후순위.

### 일지 우선 트랙 (지금 할 일)

**인증 원칙:** `/admin` 비밀번호(admin-session) 한 번으로 충분. Supabase 매직링크 추가 로그인 없음. 공지와 동일하게 서버 API + service role.

| 단계 | 작업 | 목표 |
|------|------|------|
| **J1** | `/api/journal-snapshots` (admin-session + service role) | ✅ 공지 API 패턴 복제 |
| **J2** | WeeklyJournal 수동 저장·비교 → admin API | ✅ 브라우저 Supabase Auth 미사용 |
| **J2b** | `VITE_SUPABASE_MANUAL_MIRROR_ENABLED` gate | ✅ production 기본 off |
| **J3** | Preview `MANUAL_MIRROR=true` + service_role GRANT | ✅ A/B/C 「Supabase 저장 완료」(2026-07-09) |
| **J4** | 신선도 비교 UI (읽기 전용) | ✅ 원격 vs 로컬 `updated_at` · 「원격이 더 최신」 |
| **J5** | 수동 가져오기 + 충돌 UX | ✅ 팀장 Supabase → local 복구 |
| **J6** | 자동 미러 (저장 시 debounce) | ✅ Preview 팀장 local→Supabase |
| **J7a** | 신선도 폴링 (읽기 전용) | ✅ Preview 「원격이 더 최신」 자동 갱신 |
| **J7-0** | Realtime·Blob 축소 설계 문서 | ✅ [`j7-journal-realtime-blob-plan.md`](./j7-journal-realtime-blob-plan.md) |
| **J7b** | Member-scoped Supabase API + dual-write | ✅ Preview · Blob+Supabase 병행 |
| **J7c** | Pull SoT flip (Supabase-first) | ✅ Preview · Blob fallback |
| **J7d** | Journal Blob POST demote | ✅ Preview MANUAL_MIRROR 시 POST off |
| **J7e** | `sync_events` 감사 + 알림(폴링 연동) | 얇게 · 자동 merge 없음 · 다음 |

상세 설계: [`j7-journal-realtime-blob-plan.md`](./j7-journal-realtime-blob-plan.md)

### 후순위 (일지 J3 통과 후)

- 공지 end-to-end QA (§5) — 기본 동작은 이미 OK
- Lunch Recommendation v2 MVP (§7)
- CSR / KPI UX 개선 (§2·§3)

상세: §9 · [`journal-supabase-sync-plan.md`](./journal-supabase-sync-plan.md) · [`j7-journal-realtime-blob-plan.md`](./j7-journal-realtime-blob-plan.md)

## 8. Supabase Phase 0 (운영 인프라 — 대부분 완료)

| # | 항목 | 상태 | 비고 |
|---|------|------|------|
| 1 | `phase0-apply.sql` 운영 DB 적용 | ✅ | 사용자 SQL Editor 실행 (2026-07-06) |
| 2 | Vercel `VITE_SUPABASE_*` | ✅ | 기존 등록 확인 |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` (Functions) | ✅ | 공지·일지 admin API |
| 4 | `/api/admin-session` + `/api/announcements` | ✅ | 공지 쓰기 |
| 5 | `/api/journal-snapshots` | ✅ | 일지 수동 미러 (admin-session) |
| 6 | `VITE_SUPABASE_MANUAL_MIRROR_ENABLED` | ✅ 코드 gate | production `false`, Preview만 `true` |
| 7 | 운영 QA (공지·헬스) | ✅ | 점검 정상 |

**채택하지 않음:** Supabase 매직링크 / `SupabaseAuthControls`를 관리자 필수 로그인으로 추가. 일지·공지 쓰기는 `/admin` 세션만 사용.

**J3 완료 (2026-07-09):** Preview `MANUAL_MIRROR=true` + [`j3-grant-service-role-journal.sql`](../supabase/j3-grant-service-role-journal.sql) GRANT + A/B/C 「Supabase 저장 완료」 확인.
**J4 완료:** 일지 상태 패널에 로컬 vs Supabase `updated_at` 신선도 표시(「원격이 더 최신」 포함, 가져오기 없음).
**J5 완료:** 팀장 「Supabase에서 가져오기」로 선택 구성원 슬라이스 복구. 원격이 더 최신이면 바로 반영, 로컬이 더 최신/동일이면 확인 후 덮어씀.
**J6 완료:** Preview `MANUAL_MIRROR` + `/admin` 팀장에서 로컬 저장 후 debounce(8s)로 Supabase upsert. Blob `autoSyncCloud`는 계속 off. Production은 `MANUAL_MIRROR=false` 유지.
**J7a 완료:** Preview 미러 도구 표시 중 `GET /api/journal-snapshots`를 ~30s·focus로 폴링해 「원격이 더 최신」만 자동 갱신. 자동 가져오기·Blob 변경 없음. anon Realtime은 admin-session 구조상 보류.
**J7-0 완료:** Realtime·Blob 축소 로드맵 문서화 — [`j7-journal-realtime-blob-plan.md`](./j7-journal-realtime-blob-plan.md). 본선은 Blob→Supabase per-member 팀 공유 이전(J7b–J7d). Realtime은 알림·`sync_events` 감사(J7e).
**J7b 완료:** member referer로 `/api/journal-snapshots` GET/POST 허용. B/C 「팀 공유 저장」이 Preview `MANUAL_MIRROR`일 때 Blob 성공 후 Supabase dual-write(best-effort). 빈 일지 덮어쓰기 가드.
**J7c 완료:** 「팀 공유본 가져오기」가 Preview에서 Supabase `scope=team` 우선, Blob fallback. 비교 UI Supabase-first.
**J7d 완료:** Preview `MANUAL_MIRROR`일 때 journal Blob **POST demote**(GET 유지). 팀 공유 저장은 Supabase 주 경로. 롤백: `VITE_JOURNAL_BLOB_POST_ENABLED=true`. 다음은 **J7e**.

---

## 9. Supabase 전환 로드맵 (코드·운영)

### 현재 체제 (진실 공급원)

| 데이터 | 저장소 | 운영 상태 |
|--------|--------|-----------|
| 업무일지 | localStorage + Blob 수동 공유 | **주 저장소** |
| KPI 운영·승인 | localStorage + Supabase 미러 | Supabase 읽기/미러 동작 (#52–#56, #68) |
| 공지 | Supabase (공개 공지 anon 조회, 초안·쓰기 admin auth) | **운영 중** |
| CSR | Supabase (anon RLS) | **운영 중** |
| 일지 Supabase 백업 | `journal_snapshots` via `/api/journal-snapshots` | 코드 ✅, **미러 플래그 production off** |

### 단계별 진행률

```
[████████░░░░░░░░░░░░] 일지 Supabase 트랙 ~40%

J1 admin API           ██████████  완료
J2 클라이언트 API 전환  ██████████  완료
J2b MANUAL_MIRROR gate ██████████  완료
J3 Preview 미러 파일럿 ██████████  완료
J4 신선도 UI           ██████████  완료
J5 수동 가져오기       ██████████  완료
J6 자동 미러           ██████████  완료
J7a 신선도 폴링        ██████████  완료
J7-0 설계 문서         ██████████  완료
J7b member dual-write  ██████████  완료
J7c pull SoT flip      ██████████  완료
J7d Blob demote        ██████████  완료 ←
J7e sync_events 알림   ░░░░░░░░░░  다음

(인프라: journal_snapshots DDL ✅ · env ✅ · admin-session API ✅ · Preview MANUAL_MIRROR ✅ · service_role GRANT ✅)
```

### 앞으로 할 일 — **일지 우선** (J3→J7)

| 단계 | 작업 | 담당 | 완료 기준 |
|------|------|------|-----------|
| **J3** | Preview `MANUAL_MIRROR=true` + service_role GRANT | ✅ A/B/C 「Supabase 저장 완료」(2026-07-09) |
| **J4** | 신선도 비교 UI (가져오기 없음) | ✅ | 「원격이 더 최신」표시 |
| **J5** | 수동 가져오기·충돌 확인 UX | ✅ | 팀장 복구 1회 검증 |
| **J6** | local 저장 시 자동 미러 (debounce, admin 세션) | ✅ | 수동 버튼 없이 upsert |
| **J7a** | 신선도 폴링 (~30s + focus, 읽기 전용) | ✅ | 「원격이 더 최신」자동 갱신 |
| **J7-0** | Realtime·Blob 축소 설계 | ✅ | [`j7-journal-realtime-blob-plan.md`](./j7-journal-realtime-blob-plan.md) |
| **J7b** | Member-scoped API + Blob/Supabase dual-write | ✅ | Preview B/C 저장 시 양쪽 갱신 |
| **J7c** | Pull SoT flip (Supabase-first) | ✅ | Blob 없이도 peer pull |
| **J7d** | Journal Blob POST demote | ✅ | MANUAL_MIRROR 시 POST off, GET 유지 |
| **J7e** | `sync_events` 감사 + 알림 | 개발 | 자동 merge 없음 · 폴링 연동 |

**인증:** `/admin` 비밀번호 → admin-session. 매직링크 불필요.

**J3 운영 체크리스트:** [`supabase-phase0-runbook.md`](./supabase-phase0-runbook.md) §6. Preview env → Redeploy → A/B/C 수동 저장·비교 → Production은 `false` 유지.

**하지 않을 것 (J3 전):** localStorage/Blob 제거, 운영 `MANUAL_MIRROR=true`, 자동 병행

### 기타 (일지 J3 이후)

| 작업 | 비고 |
|------|------|
| 공지 end-to-end QA | §5, 기본 OK |
| Lunch v2 · CSR · KPI UX | §2·§3·§7 |

### 관련 문서·코드

- [`docs/supabase-phase0-runbook.md`](./supabase-phase0-runbook.md)
- [`docs/journal-supabase-sync-plan.md`](./journal-supabase-sync-plan.md)
- [`docs/j7-journal-realtime-blob-plan.md`](./j7-journal-realtime-blob-plan.md)
- [`docs/supabase-schema-plan.md`](./supabase-schema-plan.md)
- `api/journal-snapshots.js`, `src/utils/supabaseJournalSnapshot.js`, `src/constants/supabaseSync.js`

---

## 7. Lunch Recommendation v2

- **상태:** Backlog (계획 보강 완료, 구현 전)
- **모듈:** `?mode=edit&module=lunch` (edit 모드 전용)
- **관련 문서:** [`docs/lunch-pick-setup.md`](./lunch-pick-setup.md) — v1 설정·운영
- **목표:** 단순 가중 랜덤 추천 → **식대 기준 분리·메뉴 단위 추천·방문 기록·추천 이유**가 있는 운영 가능한 점심 도우미

### 7.1 v1 현황 (기준선)

| 영역 | v1 구현 | 한계 |
|------|---------|------|
| 데이터 | `public/data/yeouido-lunch.json` + 브라우저 `localStorage` 커스텀 식당 | 팀 공유·동기화 없음, `menus` 가격 미입력 식당 다수 |
| 추천 | `src/utils/lunchRecommend.js` — 필터 후 **가중 랜덤** 3곳 | 점수·이유 없음, 날씨·다양성 미반영 |
| 식대 | `LUNCH_ALLOWANCE_WON = 13000`, `priceLevel` 1/2/미확인 | **이내·초과 동시 노출 UI 없음**, 초과 금액 미표시 |
| 방문 | `tms-lunch-history-v1` (기기별) | N일 제외만 가능, 횟수·팀 통계 없음 |
| 위치 | 프리셋·직접 지정·카카오 검색 (`KAKAO_REST_API_KEY`) | 거리는 `walkMinutes` 수동·추정 위주 |
| UI | `src/pages/LunchPickPage.jsx` — 오늘·단골·검색·등록 탭 | 추천 결과 1건+대안 2건 단일 열 |

**v1에서 재사용할 코드 (v2에서 확장, 삭제하지 않음)**

- `src/utils/lunchMenuPrice.js` — `menus` 기반 식대 이내/초과 판정·대표 메뉴
- `src/hooks/useLunchHistory.js`, `useLunchSpots.js`, `useLunchNearbySpots.js`
- `src/constants/lunchPick.js` — 필터 옵션·localStorage 키
- `buildHistoryExcludeIds()` — 최근 방문 제외

### 7.2 v2 핵심 정책

1. **기준 식대:** 13,000원 (`meta.lunchAllowanceWon` / `LUNCH_ALLOWANCE_WON`)
2. **결과 구분:** 추천 패널을 **`식대 이내`** / **`식대 초과`** 두 구역으로 분리
3. **초과 표시:** 대표 메뉴 가격이 13,000원을 넘으면 **`+N원 초과`** (예: 메뉴 15,000원 → `+2,000원 초과`)
4. **미확인 가격:** `priceLevel`·`menus` 모두 없으면 「가격 미확인」뱃지, **초과로 단정하지 않음** (v1 `kakaoPlaceToSpot` 정책 유지)
5. **추천 이유:** 각 카드에 1~2줄 근거 (예: `7일 미방문 · 도보 5분 · 국물 태그`)
6. **비목표 (MVP):** 팀 전체 실시간 동기화, 리뷰 크롤링, 자동 메뉴 가격 수집

### 7.3 데이터 모델

#### 7.3.1 식당·메뉴 (JSON 시드 + 등록 탭)

`yeouido-lunch.json` `spots[]` 확장 (하위 호환):

```json
{
  "id": "yeouido-003",
  "name": "여의도 순대국",
  "category": "한식",
  "priceLevel": 1,
  "walkMinutes": 6,
  "tags": ["fast", "noodle", "rain"],
  "weatherTags": ["rain", "cold"],
  "menus": [
    { "name": "순대국", "priceWon": 9000, "active": true },
    { "name": "뼈해장국", "priceWon": 10000, "active": true }
  ],
  "weight": 1.1,
  "active": true
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `menus[].name` | 권장 | 메뉴명 |
| `menus[].priceWon` | 권장 | 원 단위; 없으면 가격 미확인 |
| `menus[].active` | 선택 | `false`면 추천 풀 제외 (기본 `true`) |
| `weatherTags` | 선택 | `rain` `hot` `cold` — v2.2 스코어용 |
| `active` | 선택 | 식당 전체 비활성 (폐업·보류) |

**MVP 데이터 정비 작업 (구현 전):** 시드 `spots` 중 단골 상위 N곳에 `menus` + 실제 가격 입력. 카카오-only 식당은 등록 탭에서 메뉴 입력 유도.

#### 7.3.2 방문 이력 (MVP: localStorage 유지)

| 키 | v1 | v2 MVP | v2.3 (후보) |
|----|-----|--------|-------------|
| `tms-lunch-history-v1` | `id → visitedAt ISO` | `id → { lastVisitedAt, visitCount }` 로 **스키마 확장** (읽기 시 v1 마이그레이션) | Supabase `lunch_visits` 팀 공유 |

방문 기록 시: `visitCount++`, `lastVisitedAt` 갱신. UI에 「최근 방문 · N회 방문」 표시.

### 7.4 추천 알고리즘 (v2 MVP)

v1의 `pickWeightedRandom` 대신 **필터 통과 후 점수 정렬 + 상위 샘플링** (완전 결정론적이면 매일 같아지므로 상위 K개 중 가중 랜덤 1건 권장).

**점수 구성 (초안, 합산 후 정규화):**

| 요소 | 가중치 | 규칙 |
|------|--------|------|
| 식대 적합 | 높음 | 이내 메뉴 존재 + 대표 메뉴가 13,000원에 가까울수록 가산 (식비 절약) |
| 최근 방문 | 높음 | `historySkipDays` 이내 방문 시 제외 (v1 유지); 그 외 오래 안 간 곳 가산 |
| 방문 횟수 | 중간 | 동일 기간 내 과다 방문(예: 30일 5회+) 감점 |
| 도보 | 중간 | `walkMinutes` 짧을수록 가산; 필터 `maxWalkMinutes` 와 별개 |
| 태그 일치 | 중간 | 사용자 선택 태그·`rain` 등 컨텍스트 태그 일치 시 가산 |
| `weight` | 낮음 | JSON 시드 팀 선호도 (v1 호환) |
| 카테고리 다양성 | 중간 | **세션 내** 이미 추천된 카테고리와 같으면 감점 (`sessionExclude` 확장) |

**출력:**

- `식대 이내` 구역: 대표 메뉴 `priceWon ≤ 13000` 인 식당 1~2건
- `식대 초과` 구역: 대표 메뉴 `priceWon > 13000` 인 식당 0~1건 (선택적 「가끔은 초과」)
- 각 카드: `reasons: string[]` (상위 2~3개 점수 요인을 문장화)

구현 위치 후보: `src/utils/lunchRecommend.js` 에 `scoreLunchSpot()`, `recommendLunchV2()` 추가; 단위 테스트 필수.

### 7.5 UI/UX (v2 MVP)

```
┌─ 오늘 뭐 먹지 ─────────────────────────────┐
│ [기준 위치] [필터 ▼] [다시 추천]              │
├─────────────────────────────────────────────┤
│ 식대 이내 (13,000원)                         │
│  ┌ 카드: 순대국 · 9,000원                    │
│  │  7일 미방문 · 도보 6분 · 국물              │
│  └ [방문 기록] [지도]                        │
│  ┌ 카드: (대안) …                            │
├─────────────────────────────────────────────┤
│ 식대 초과                                    │
│  ┌ 카드: IFC 푸드 · 샐러드 15,000원 (+2,000) │
│  │  단체 · 실내 이동                          │
│  └ …                                         │
├─────────────────────────────────────────────┤
│ 풀 N곳 · 필터/방문 제외 M곳                   │
└─────────────────────────────────────────────┘
```

- 필터 「전체 (식대 이내 우선)」는 **두 구역 모두 채우되 이내를 위에** (v1 `pickWithPricePriority` 의도를 UI로 명시)
- 「가격 미확인」은 초과 구역에 넣지 않고 별도 접기 섹션 또는 이내 하단 안내
- 등록 탭: 메뉴·가격 입력을 **필수에 가깝게** 유도 (저장 전 경고)

### 7.6 단계별 로드맵

#### Phase 1 — v2 MVP (문서·데이터 + 코어 UX)

| 항목 | 내용 |
|------|------|
| 데이터 | 시드 `menus` 보강, `active` / `menus[].active` 지원 |
| 알고리즘 | 점수 기반 추천 + `reasons` |
| UI | 이내/초과 분리 패널, 초과 금액, 추천 이유 |
| 이력 | localStorage 스키마 v2 + v1 마이그레이션, 방문 횟수 표시 |
| 테스트 | `lunchRecommend`, `lunchMenuPrice` 단위 테스트 |
| 문서 | `lunch-pick-setup.md` 에 v2 UI·데이터 규칙 반영 |

**완료 기준 (Acceptance):**

- [ ] 식대 이내·초과가 동시에 보이고, 초과 메뉴에 `+N원` 표시
- [ ] 추천 카드에 이유 1줄 이상
- [ ] 7일 방문 제외 + 방문 기록 후 재추천 시 해당 식당 제외
- [ ] `menus` 없는 카카오 식당이 초과로 오분류되지 않음
- [ ] 기존 v1 localStorage 키 깨지지 않음 (마이그레이션 또는 병행 읽기)

#### Phase 2 — v2.1 위치·거리

- 기준 좌표 ↔ 식당 좌표 거리 계산 (카카오 place `x`,`y` 저장)
- `walkMinutes` 자동 추정 또는 거리(km) 표시
- 「가까운 순」 정렬 옵션

**의존성:** 식당 등록·시드에 `lat`/`lng` 또는 카카오 place id

#### Phase 3 — v2.2 날씨

- Open-Meteo 등 무료 API로 여의도(기준 좌표) 현재 날씨 조회 (서버리스 프록시 또는 Vercel function)
- `weatherTags` / 규칙 테이블로 스코어 가중

| 날씨 | 우선 태그·메뉴 |
|------|----------------|
| 비 | `rain`, 국물, 짧은 `walkMinutes` |
| 더움 (예: 28°C+) | 냉면·샐러드·`cold` 메뉴, 가까운 곳 |
| 추움 (예: 5°C 이하) | 국밥·찌개·`hot` |

#### Phase 4 — v2.3 팀 공유 (선택, Supabase)

- 테이블 후보: `lunch_spots`, `lunch_menus`, `lunch_visits` (member id)
- 관리자가 시드 편집 → 전원 동일 목록; 방문은 개인별 row
- **MVP 이후** 검토 — RLS·운영 부담 대비 이득 평가 후 진행

### 7.7 날씨·태그 매핑 (v2.2 참고)

v1 `LUNCH_TAGS` (`src/constants/lunchPick.js`) 와 정렬:

- `rain` ↔ 실내/비 오는 날
- `noodle` ↔ 국물·면 (비·추움 가산)
- `cuisineWestern` + 샐러드 메뉴명 키워드 ↔ 더운 날

메뉴명 키워드 휴리스틱 (스코어 보조): `냉면`, `샐러드`, `국밥`, `찌개`, `칼국수` 등 — `menus[].name` 기준.

### 7.8 리스크·오픈 이슈

| 이슈 | 대응 |
|------|------|
| 메뉴 가격 변동 | `menus` 수동 갱신; 화면에 「최종 확인: JSON updated 날짜」 |
| 카카오 API 가격 없음 | 등록 탭 메뉴 입력 필수화; 미입력 시 추천 순위 하향 |
| localStorage 기기별 분열 | MVP는 v1과 동일; 팀 공유는 v2.3 |
| 점수 튜닝 주관성 | 가중치를 상수 파일로 분리, 팀 피드백 후 조정 |

### 7.9 구현 시 터치할 파일 (체크리스트)

- `src/pages/LunchPickPage.jsx` — 분리 UI, reasons 렌더
- `src/utils/lunchRecommend.js` — v2 스코어링
- `src/utils/lunchMenuPrice.js` — 초과 금액 헬퍼 (`excessWon`)
- `src/constants/lunchPick.js` — allowance·태그 확장
- `src/hooks/useLunchHistory.js` — visitCount 마이그레이션
- `public/data/yeouido-lunch.json` — menus 데이터 보강
- `docs/lunch-pick-setup.md` — 운영 가이드
- `src/utils/lunchRecommend.test.js` (신규 권장)

---

*§7 마지막 갱신: 2026-07-06 — v1 코드 기준선·데이터 스키마·단계별 AC 보강*
