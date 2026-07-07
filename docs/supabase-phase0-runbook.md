# Supabase Phase 0 런북

운영 URL: https://edu-team-tms-ten.vercel.app/admin

Phase 0 목표: **DDL 적용 → Vercel env → Auth Redirect → 프로필 프로비저닝 → 연결 검증**.  
일지 자동 동기화·`MANUAL_MIRROR` 활성화는 **Phase 2** (이 단계에서는 하지 않음).

## 체크리스트

| # | 작업 | 담당 | 완료 |
|---|------|------|------|
| 1 | `phase0-apply.sql` 실행 | Supabase SQL Editor | ✅ |
| 2 | Vercel env 2종 설정 | Vercel 대시보드 | ✅ |
| 3 | Auth Redirect URL 등록 | Supabase Auth | ☐ |
| 4 | 팀장 매직링크 가입 | `/admin` | ☐ |
| 5 | `provision-tms-profiles.sql` (admin 1건) | SQL Editor | ☐ |
| 6 | `npm run verify:supabase` | 로컬 CLI | ☐ |
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

설정 후 **Redeploy** (환경변수는 빌드 시 주입).

로컬 개발: `.env.example` → `.env.local` 복사 후 동일 키 입력.

---

## 3. Supabase Auth Redirect URL

Supabase → **Authentication → URL Configuration**

**Site URL (예시):**

```
https://edu-team-tms-ten.vercel.app
```

**Redirect URLs (추가):**

```
https://edu-team-tms-ten.vercel.app/**
http://localhost:3000/**
```

Preview 배포도 쓰면 해당 `*.vercel.app` URL 추가.

---

## 4. 사용자 가입 (매직링크)

1. 운영 TMS 상단 **Supabase 로그인** (또는 Auth UI)에서 이메일 입력  
2. 메일 링크 클릭 → 세션 생성  
3. 팀장 1명 + 구성원 A/B/C 각각 1계정

---

## 5. `tms_profiles` 프로비저닝

1. SQL Editor:

   ```sql
   select id, email from auth.users order by created_at;
   ```

2. [`supabase/provision-tms-profiles.sql`](../supabase/provision-tms-profiles.sql)의 UUID·이메일을 실제 값으로 바꿔 실행

3. 확인:

   ```sql
   select email, member_code, role from public.tms_profiles;
   ```

---

## 6. CLI 검증

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

## 7. 운영 QA

| 확인 | URL / 방법 | 기대 |
|------|------------|------|
| Supabase 헬스 | AppShell 「Supabase 점검」 | **Supabase 정상** |
| 공지사항(구성원) | 구성원 URL `?module=announcements` | 공개 공지만 노출 |
| 공지사항(관리자) | `/admin?module=announcements` + Supabase admin 로그인 | 테이블 오류 없음, 등록 가능 |
| 일지 (기존) | `?module=journal` | localStorage 동작 동일 |
| 일지 미러 버튼 | `MANUAL_MIRROR=false` | 버튼 **안 보임** (정상) |

---

## 다음 단계 (Phase 1~2)

1. **공지 QA** — 초안 등록·게시·구성원 노출  
2. **Preview**에서만 `VITE_SUPABASE_MANUAL_MIRROR_ENABLED=true` → 일지 「Supabase 백업 저장」 파일럿  
3. 신선도 비교 UI (코드 작업, 미구현)

---

## 롤백

- 앱: env에서 `VITE_SUPABASE_URL` 제거 → Supabase 비활성 (localStorage만 사용)  
- DB: 테이블 삭제는 **데이터 손실** — Phase 0에서는 비권장. 문제 시 앱만 비활성화.

## 관련 문서

- [`journal-supabase-sync-plan.md`](./journal-supabase-sync-plan.md)
- [`supabase-schema-plan.md`](./supabase-schema-plan.md)
- [`operations-backlog.md`](./operations-backlog.md) §8
