# J7 — Journal Realtime + Blob 축소 설계

> **상태:** J7-0 설계 문서 (2026-07-10)  
> **범위:** 업무일지 팀 공유 SoT를 Blob → Supabase per-member로 이전하고, Realtime은 알림·감사만.  
> **비범위:** Production `MANUAL_MIRROR=true`, localStorage 제거, 자동 pull/merge, 매직링크 필수화, improve-projects/ledger Blob.

관련: [`operations-backlog.md`](./operations-backlog.md) §6·§9 · [`journal-supabase-sync-plan.md`](./journal-supabase-sync-plan.md) · [`journal-live-latest-concurrency-analysis.md`](./journal-live-latest-concurrency-analysis.md) · [`supabase-phase0-runbook.md`](./supabase-phase0-runbook.md)

---

## 1. 현재 상태 (출발점)

| 저장소 | 역할 today |
|--------|------------|
| localStorage `tms-weekly-journal-v1` | 편집 SoT (즉시) |
| Blob `journal/live-latest.json` | **팀 공유 SoT** (B/C 수동 저장·가져오기) |
| Supabase `journal_snapshots` | Preview 미러/백업 (admin-session, Production `MANUAL_MIRROR=false`) |

```
Edit → localStorage
         ├─ manual 「팀 공유 저장」 → POST /api/journal-snapshot → Blob live-latest
         ├─ manual 「팀 공유본 가져오기」 → GET /api/journal-snapshot → localStorage
         └─ (Preview /admin) J6 debounce → POST /api/journal-snapshots → Supabase row
              + J7a poll GET → 「원격이 더 최신」 (자동 pull 없음)
```

### 제약 (바꾸지 않음)

- `/admin` 비밀번호(admin-session)만으로 관리자 쓰기 — **매직링크 필수화 안 함**
- `anon`은 `journal_snapshots` SELECT/Realtime 불가 → J7a 폴링이 의도된 브릿지
- Blob 단일 파일 RMW는 **교차 구성원 lost-update** 잔존 ([concurrency analysis](./journal-live-latest-concurrency-analysis.md))
- improve-projects / ledger Blob은 **별 트랙**

### J1–J7a 완료 요약

| 단계 | 내용 |
|------|------|
| J1–J3 | admin API + Preview `MANUAL_MIRROR` + service_role GRANT |
| J4–J5 | 신선도 UI + 수동 가져오기·충돌 UX |
| J6 | Preview 팀장 local→Supabase auto-mirror (Blob `autoSyncCloud` off) |
| J7a | Preview 신선도 ~30s·focus 폴링 (읽기 전용) |

---

## 2. 목표 상태 (J7 완료 시)

| 저장소 | 역할 |
|--------|------|
| localStorage | 계속 즉시 편집면 |
| Supabase `journal_snapshots` (per-member) | **팀 공유 SoT** (교차 RMW 제거) |
| Blob `journal/live-latest.json` | 백업·장애 복구·롤백 (POST 기본 off, GET 유지) |

```
Edit → localStorage
         ├─ member/admin API → Supabase per-member rows
         ├─ manual pull ← Supabase (Blob fallback)
         └─ freshness: poll (J7a) ± sync_events 감사 (알림만, 자동 merge 없음)
Blob live-latest ─(GET only / disaster)→ localStorage
```

- Realtime = **알림만** (자동 pull/merge 없음)
- admin-session 경로의 신선도는 **폴링 유지가 기본**
- Production `MANUAL_MIRROR` 켜기는 **별도 승인** (J7 단계 완료 ≠ Production cutover)

---

## 3. 확정한 설계 선택

1. **Blob 축소가 J7의 본선** — 교차 구성원 동시 저장 버그를 구조적으로 없앰.
2. **Realtime은 「알림」만** — J5 수동 가져오기 UX 유지. auto-merge는 J7 이후.
3. **브라우저 Realtime on `journal_snapshots`는 보류** — Supabase Auth/`tms_profiles` 필수화와 충돌. 대신:
   - 신선도: J7a 폴링 유지·확장
   - 감사: 서버가 `sync_events`에 journal upsert 이벤트 기록 (service_role)
   - push가 꼭 필요해지면 후속: admin-session SSE 또는 **선택적** Auth 구독 (쓰기 게이트는 아님)
4. **B/C Supabase 쓰기**는 admin-session이 아니라 **기존 Blob API와 같은 member referer 게이트**로 확장 (`api/journal-snapshot.js`의 slug→member 매핑). `/admin` 리더 도구는 계속 admin-session.

---

## 4. API 계약

### 4.1 Admin-session 경로 (기존, 유지)

| | |
|--|--|
| Endpoint | `GET/POST /api/journal-snapshots` |
| Auth | HttpOnly `admin-session` + allowed publish origin + `/admin` referer |
| DB | `SUPABASE_SERVICE_ROLE_KEY` (RLS bypass) |
| 용도 | Preview `/admin` 미러 저장·가져오기·신선도·비교·J6 auto-mirror |

### 4.2 Member-scoped 경로 (J7b에서 추가)

| | |
|--|--|
| Endpoint | 동일 `/api/journal-snapshots` (또는 명시적 member 분기) |
| Auth | Blob `journal-snapshot`과 동일: allowed origin + **referer slug → memberCode**가 body `memberCode`와 일치 |
| DB | 동일 service_role upsert (한 row = 한 member) |
| 용도 | B/C 「팀 공유 저장」의 Supabase 병행 쓰기 / 이후 pull SoT |

**규칙:**

- Member 경로는 **본인 `memberCode`만** 쓰기 가능 (referer mismatch → 403)
- Admin 경로는 A/B/C 선택 가능 (기존)
- Optimistic lock: `updated_at` 기반 409 (기존 J4/J5 계약 유지)
- **Empty slice guard:** 빈 일지 슬라이스로 원격 row/Blob member slice를 덮지 않음 (J7b)

### 4.3 Blob API (축소 전·후)

| 단계 | POST `/api/journal-snapshot` | GET |
|------|------------------------------|-----|
| today ~ J7c | 팀 공유 쓰기 SoT | 팀 공유 읽기 |
| J7b | dual-write (Blob + Supabase) | 유지 |
| J7c | 유지 (fallback 쓰기) | pull은 Supabase-first |
| J7d | **flag로 POST off** | 재해 복구용 유지 |

---

## 5. 단계 (구현 순서)

### J7-0 — 설계 문서 (본 문서) ✅

산출물: 본 파일 + backlog / sync-plan / sot-map 링크. **코드 변경 없음.**

### J7b — Member-scoped Supabase API + dual-write (Preview) ✅

- `api/journal-snapshots.js`에 member referer 허용 경로 추가
- B/C 「팀 공유 저장」: **Blob POST 유지 + Supabase member upsert 병행**
  - Gate: Preview `VITE_SUPABASE_MANUAL_MIRROR_ENABLED` (전용 flag 없이 기존 gate 재사용)
- Empty overwrite 가드를 Supabase·Blob 양쪽에 동일 적용
- 테스트: API auth 매트릭스, empty guard, optimistic lock 409

**완료 기준:** Preview에서 B/C 저장 후 Supabase row와 Blob 모두 갱신. 교차 저장 시 Supabase rows는 서로 덮지 않음.

### J7c — Pull SoT flip (Supabase-first, Blob fallback)

- 「팀 공유본 가져오기」: A/B/C rows merge → localStorage; Blob은 fallback
- `/admin` 비교 UI에 Supabase-first 표시
- J7a freshness를 팀 공유 pull 전 비교에도 재사용

**완료 기준:** Preview에서 Blob을 무시해도 Supabase만으로 peer pull 가능.

### J7d — Blob demote

- Feature flag로 journal Blob **POST off** (GET은 재해 복구용 유지)
- 북마크/runbook SoT 문구: 팀 공유 = Supabase
- improve-projects Blob·ledger Blob **미변경**

**완료 기준:** Preview 1주 파일럿 후 flag 기본 demote. 문제 시 flag로 Blob POST 즉시 복구.

### J7e — Realtime/알림 (얇게)

- `POST /api/journal-snapshots` 성공 시 `sync_events` insert  
  (`source=journal`, `member_code`, `updated_at`만 — **payload 전체 미포함**)
- UI: 「원격 갱신됨」 배지 → 기존 J5 pull CTA (자동 반영 없음)
- 구독: **당분간 J7a 폴링으로 배지 트리거** (Auth 없이). 진짜 websocket은 Auth/SSE 결정 후 별 PR

**완료 기준:** 이벤트 테이블에 감사 흔적 + UI 알림이 폴링과 연동. Production Realtime publication 강제 아님.

---

## 6. 롤백

| 증상 | 조치 |
|------|------|
| Supabase dual-write/pull 이상 | team-share Supabase flag off → Blob-only 복귀 |
| Blob demote 후 공유 실패 | journal Blob POST flag 재활성 |
| `sync_events` insert 실패 | journal upsert는 성공 유지 (이벤트는 best-effort) |
| Production 사고 | `MANUAL_MIRROR=false` 유지·확인; localStorage + Blob 수동 경로 |

순서 (sync-plan과 동일 정신):

1. Supabase 팀 공유 경로 비활성
2. localStorage 기존 흐름 유지
3. Blob 수동 저장/복구 재활성
4. Supabase 데이터는 읽지 않고 보관

---

## 7. Preview 체크리스트 (단계별)

### J7b

- [ ] Preview `MANUAL_MIRROR` (또는 team-share flag) on
- [ ] B URL에서 「팀 공유 저장」 → Blob + Supabase row 갱신
- [ ] C 동시 저장 후 Supabase에서 B·C row 모두 최신
- [ ] 빈 일지로 저장 시도 → 거부/가드
- [ ] Production flag off 유지

### J7c

- [ ] 「팀 공유본 가져오기」가 Supabase-first로 peer 반영
- [ ] Blob 장애/비어 있어도 Supabase pull 가능
- [ ] 로컬이 더 최신일 때 확인 UX (J5와 동일 정신)

### J7d

- [ ] Blob POST off 후에도 Supabase 경로로 팀 공유 가능
- [ ] Blob GET으로 재해 복구 가능
- [ ] improve-projects / ledger Blob 동작 불변

### J7e

- [ ] journal upsert 후 `sync_events` row 존재
- [ ] UI 배지/라벨이 폴링과 연동, 자동 merge 없음

### Production cutover (J7 밖 — 별도 승인)

- [ ] Preview 1주+ 안정
- [ ] 명시 승인 후 `VITE_SUPABASE_MANUAL_MIRROR_ENABLED=true` (또는 후속 production gate)
- [ ] 북마크·릴리즈 안내

---

## 8. 명시적 비범위

- Production `VITE_SUPABASE_MANUAL_MIRROR_ENABLED=true` (별도 승인)
- localStorage 제거 / `autoSyncCloud=true`
- 자동 pull·자동 merge
- 매직링크 필수 로그인
- improve-projects / ledger Blob 축소
- `anon` SELECT on `journal_snapshots`
- 브라우저 Realtime websocket on `journal_snapshots` (Auth 필수화 전)

---

## 9. 주요 코드·문서 앵커

| Path | 역할 |
|------|------|
| `api/journal-snapshot.js` | Blob 팀 공유 GET/POST (member referer) |
| `api/journal-snapshots.js` | Supabase GET/POST (admin-session today; + member path in J7b) |
| `src/utils/supabaseJournalSnapshot.js` | 브라우저 → journal-snapshots API |
| `src/hooks/useJournalSupabaseFreshness.js` | J7a 폴링 |
| `src/constants/supabaseSync.js` | `MANUAL_MIRROR`, poll/debounce constants |
| `src/constants/improveProjectSharingConfig.js` | `SHOW_BC_JOURNAL_TEAM_SHARE_UI` |
| `supabase/schema.sql` | `journal_snapshots`, `sync_events` |
| `docs/journal-live-latest-concurrency-analysis.md` | Blob 교차 lost-update |

---

## 10. 다음 작업

1. ~~본 문서 머지 (J7-0)~~ ✅
2. ~~**J7b** member-scoped API + dual-write + empty guard~~ ✅
3. **J7c** Pull SoT flip (Supabase-first, Blob fallback)
