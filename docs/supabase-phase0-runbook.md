# Supabase Phase 0 런북

운영 URL: https://edu-team-tms-ten.vercel.app/admin

Phase 0 목표: **DDL 적용 → Vercel env → admin-session API → 연결 검증**.
일지 자동 동기화·production `MANUAL_MIRROR` 활성화는 **J3 Preview 파일럿 이후** (이 단계에서는 하지 않음).

**인증 원칙:** `/admin` 비밀번호 → `admin-session` 쿠키 → `/api/announcements`·`/api/journal-snapshots` (service role).
Supabase 매직링크는 일지·공지 필수 로그인이 **아님**.

## 체크리스트

| # | 작업 | 담당 | 완료 |
|---|------|------|------|
| 1 | `phase0-apply.sql` 실행 | Supabase SQL Editor | ✅ |
| 2 | Vercel env (`VITE_SUPABASE_*`, service role, admin-session) | Vercel 대시보드 | ✅ |
| 3 | `/api/admin-session` + `/api/announcements` | 코드·운영 | ✅ |
| 4 | `/api/journal-snapshots` (admin-session) | 코드 | ✅ |
| 5 | `VITE_SUPABASE_MANUAL_MIRROR_ENABLED=false` (Production) | Vercel | ✅ |
| 6 | `npm run verify:supabase` (선택) | 로컬 CLI | ☐ |
| 7 | 운영 QA (공지·헬스) | 브라우저 | ✅ |

---

## 1. DDL 적용

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **SQL Editor** → New query
3. [`supabase/phase0-apply.sql`](../supabase/phase0-apply.sql) 전체 붙여넣기 → **Run**
4. 결과 하단에 **8개 테이블** 목록이 나오면 성공:

   `announcements`, `csr_requests`, `journal_snapshots`, `kpi2_row_approvals`, `kpi_monthly_approvals`, `kpi_operational_snapshots`, `sync_events`, `tms_profiles`

> 재실행해도 안전합니다 (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`).

### 정책 요약

| 테이블 | Phase 0 정책 |
|--------|----------------|
| `announcements` | 공개 공지만 anon 조회, 초안 조회·등록·수정은 authenticated admin |
| `csr_requests`, KPI 승인 테이블 | **anon draft** (URL 게이트 앱과 호환) |
| `journal_snapshots`, `kpi_operational_snapshots` | **authenticated + `tms_profiles`** |
| `sync_events` | authenticated (admin 읽기, 팀원 insert) |

---

## 2. Vercel 환경변수

프로젝트 `edu-team-tms-ten` → **Settings → Environment Variables**

| 변수 | 값 | 환경 |
|------|-----|------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | Production, Preview |
| `VITE_SUPABASE_MANUAL_MIRROR_ENABLED` | `false` (Phase 0) | Production |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Production, Preview (Functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Production, Preview (Functions) |
| `TMS_ADMIN_GATE_PASSWORD` | `/admin` 비밀번호 (서버 검증) | Production, Preview |
| `TMS_ADMIN_SESSION_SECRET` | 임의 긴 랜덤 문자열 | Production, Preview |

공지·일지 등록/미러는 Supabase Auth 대신 `/api/admin-session` + `/api/announcements`·`/api/journal-snapshots` 서버 API를 사용합니다. `/admin` 비밀번호 입력 후 HttpOnly 세션 쿠키가 발급됩니다.

설정 후 **Redeploy** (환경변수는 빌드 시 주입).

로컬 개발: `.env.example` → `.env.local` 복사 후 동일 키 입력.

---

## 3. Auth / 관리자 접근 (일지·공지)

**운영 경로 (권장):** `/admin` 비밀번호 → `admin-session` 쿠키 → `/api/announcements`, `/api/journal-snapshots` (service role).
브라우저 anon 키로 `journal_snapshots`에 직접 쓰지 않는다.

선택(레거시/실험): Supabase Authentication → URL Configuration에 Site URL·Redirect를 둘 수 있으나, 일지 미러·공지 쓰기에는 **필요하지 않다**. `tms_profiles` 매직링크 프로비저닝도 일지 admin API 경로에서는 필수가 아니다.

---

## 4. CLI 검증

```bash
cd edu-team-tms
cp .env.example .env.local   # 키 입력 후
npm run verify:supabase
```

또는:

```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run verify:supabase
```

8개 테이블 모두 `OK`면 스키마·anon 연결 정상.

---

## 5. 운영 QA

| 확인 | URL / 방법 | 기대 |
|------|------------|------|
| Supabase 헬스 | AppShell 「Supabase 점검」 | **Supabase 정상** |
| 공지사항(구성원) | 구성원 URL `?module=announcements` | 공개 공지만 노출 |
| 공지사항(관리자) | `/admin?module=announcements` + `/admin` 비밀번호 | 테이블 오류 없음, 등록 가능 |
| 일지 (기존) | `?module=journal` | localStorage 동작 동일 |
| 일지 미러 버튼 | Production `MANUAL_MIRROR=false` | 버튼 **안 보임** (정상) |

---

## 6. J3 Preview 파일럿 체크리스트 (✅ 2026-07-09)

Production에는 켜지 않는다. Preview(또는 로컬)만.

| # | 확인 | 상태 |
|---|------|------|
| 1 | Preview env `VITE_SUPABASE_MANUAL_MIRROR_ENABLED=true` | ✅ |
| 2 | Preview 배포 성공 (Hobby Function 한도 이슈 없음) | ✅ |
| 3 | Production 클라이언트에 미러 비활성 메시지 유지 | ✅ |
| 4 | Preview origin allowlist (`publishOrigin`) | ✅ |
| 5 | `service_role` → `journal_snapshots` GRANT | ✅ [`j3-grant-service-role-journal.sql`](../supabase/j3-grant-service-role-journal.sql) |
| 6 | Preview `/admin?module=journal` 미러 버튼·A/B/C 저장 | ✅ 「Supabase 저장 완료」 |
| 7 | 「저장소 비교」 | ✅ (선택 확인) |
| 8 | Production 미러 버튼 미노출 | ✅ |

다음: **J7b** member dual-write ([`j7-journal-realtime-blob-plan.md`](./j7-journal-realtime-blob-plan.md)). J4~J6·J7a·**J7-0**(설계) 완료. Production `MANUAL_MIRROR`는 계속 false.

**J7a:** Preview `/admin` 미러 도구가 보일 때 `GET /api/journal-snapshots`를 ~30초·window focus로 폴링해 「원격이 더 최신」 라벨만 갱신. 자동 pull/쓰기·Blob 변경 없음.

---

## 롤백

- 앱: `VITE_SUPABASE_MANUAL_MIRROR_ENABLED=false` 또는 env에서 Supabase URL 제거 → 미러/Supabase 비활성 (localStorage·Blob 유지)
- DB: 테이블 삭제는 **데이터 손실** — Phase 0에서는 비권장. 문제 시 앱만 비활성화.

## 관련 문서

- [`journal-supabase-sync-plan.md`](./journal-supabase-sync-plan.md)
- [`supabase-schema-plan.md`](./supabase-schema-plan.md)
- [`operations-backlog.md`](./operations-backlog.md) §8–§9
