# Journal Supabase Sync Plan

## 목적

현재 TMS의 업무일지, KPI, 역량 평가 데이터는 localStorage를 우선 저장소로 사용하고, 일부 클라우드 저장/공유 흐름에서 Blob을 사용한다.

Supabase 전환의 목적은 다음과 같다.

- 사용자별 데이터 저장 안정성 개선
- 여러 기기 간 최신 데이터 동기화
- 승인/반려/확정 상태의 충돌 위험 감소
- 추후 실시간 협업 및 관리자 검토 흐름 확장
- Blob 의존도를 백업/복구 용도로 축소

## 현재 저장 구조

### localStorage

브라우저 localStorage가 기본 저장소로 사용된다.

주요 저장 키:

- `tms-weekly-journal-v1`
- `tms-kpi-operational-v1`

### Blob

Blob은 클라우드 저장, 공유 저장, 복구 흐름에서 사용된다.

현재 자동 클라우드 동기화는 기본적으로 꺼져 있으며, 수동 저장 중심으로 운용한다.

## 전환 원칙

- 기존 localStorage 저장 흐름을 즉시 제거하지 않는다
- Blob 저장/복구 흐름을 즉시 제거하지 않는다
- Supabase 저장은 병행 저장부터 시작한다
- 충돌 방지를 위해 `updatedAt` 기반 최신본 비교를 우선 적용한다
- 운영 데이터 마이그레이션은 별도 PR에서 수행한다

## 단계별 전환 계획

### 1단계. Supabase 연결 준비

- `@supabase/supabase-js` 의존성 추가
- Supabase client 유틸 추가
- `.env.example`에 환경변수 추가
- 실제 저장 로직은 변경하지 않음

### 2단계. 테이블 설계 및 SQL 초안 추가

예상 테이블:

- `journal_snapshots`
- `kpi_operational_snapshots`
- `kpi_monthly_approvals`
- `kpi2_row_approvals`
- `member_journals`
- `competency_months`
- `competency_quarters`
- `approval_events`

초기 단계에서는 스냅샷 저장 방식으로 시작하고, 이후 항목 단위 저장으로 분리한다.

이번 1단계에서는 `tms-kpi-operational-v1` 전체 스냅샷을 즉시 전환하지 않고, KPI1 월 승인과 KPI2 행 승인만 row table로 먼저 분리한다. 기존 localStorage 운영 스토어는 그대로 유지한다.

### 2-1단계. 업무일지 snapshot 유틸 추가

- `src/utils/supabaseJournalSnapshot.js`에 구성원별 `journal_snapshots` upsert/read 유틸을 추가했다.
- 유틸은 `member_code` unique key, `payload_version = 1`, 전달받은 `updatedAt` 또는 현재 시각을 사용한다.
- Supabase 환경변수가 없거나 요청이 실패해도 예외를 던지지 않고 상태 결과를 반환한다.
- 아직 기존 localStorage 저장, Blob 저장/불러오기, 업무일지 Provider/hook에 연결하지 않았다.
- 자동 저장과 Supabase 병행 저장은 아직 활성화하지 않았다.

### 3단계. 병행 저장

localStorage 저장은 유지하면서 Supabase에도 동일 데이터를 저장한다.

- localStorage: 즉시 반응/오프라인 대비
- Supabase: 클라우드 최신본
- Blob: 백업/복구

### 4단계. 최신본 비교

각 저장 단위에 `updatedAt`을 두고, 불러오기 시 최신본을 비교한다.

우선순위:

1. 더 최신인 `updatedAt`
2. 승인/반려/확정 상태는 상태 rank 우선
3. 동일 상태에서는 timestamp 비교

KPI 운영에서는 월 승인과 행 승인을 별도 row table로 저장하고, localStorage의 `months[ym][memberCode].monthly01` 및 `kpi2RowStatus[member|day|task]`와 1:1 변환한다.

### 5단계. 실시간 구독

Supabase Realtime을 이용해 관리자/구성원 화면의 변경사항을 반영한다.

초기에는 읽기 알림 수준으로 시작하고, 자동 병합은 별도 검증 후 적용한다.

### 6단계. Blob 역할 축소

Supabase 안정화 후 Blob은 다음 용도로 축소한다.

- 수동 백업
- 장애 복구
- 운영 이전 스냅샷 보관

## 롤백 전략

문제가 발생하면 다음 순서로 롤백한다.

1. Supabase 병행 저장 비활성화
2. localStorage 기존 흐름 유지
3. Blob 수동 저장/복구 유지
4. Supabase 데이터는 읽지 않고 보관만 한다

## 운영 검증 체크리스트

- 기존 localStorage 저장이 정상 동작하는가
- Blob 수동 저장/불러오기가 깨지지 않는가
- Supabase 환경변수가 없어도 앱이 정상 빌드되는가
- Supabase 환경변수가 없어도 런타임 에러가 없는가
- 업무일지 입력/수정/삭제가 기존처럼 동작하는가
- KPI 승인/반려 상태가 기존처럼 유지되는가
- 역량 평가 제출/확정 상태가 기존처럼 유지되는가

## 연결 상태 점검

Supabase 병행 저장을 시작하기 전에 연결 상태 점검 유틸을 별도 단계로 추가한다.

연결 점검 원칙:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 없으면 비활성 상태로 처리한다
- 환경변수가 없어도 앱이 실패하면 안 된다
- 연결 점검 실패가 localStorage 저장 실패로 이어지면 안 된다
- 연결 점검은 저장 로직과 분리한다
- 실제 병행 저장은 후속 PR에서 진행한다

연결 점검 대상:

- Supabase client 생성 가능 여부
- `sync_events` 테이블 조회 가능 여부
- RLS 또는 네트워크 오류 메시지 확인

## 운영 점검 이력

### 2026-06-29 Supabase health check 오류 조치

관리자 화면의 `Supabase 점검` 버튼 클릭 시 `Supabase 오류`로 표시되는 문제가 확인되었다.

조사 결과, 운영 Supabase DB에는 `public.sync_events` 테이블이 존재하고 RLS 및 SELECT policy도 설정되어 있었으나, `anon` role에 대한 테이블 SELECT 권한이 없어 클라이언트 health check가 실패하고 있었다.

확인 결과:

- `public.sync_events` 테이블 존재
- RLS 활성화 상태
- `sync_events_read_all_draft` SELECT policy 존재
- `anon` schema usage: `true`
- `anon` table select: `false`

조치 SQL:

```sql
grant select on table public.sync_events to anon;
```

조치 후 확인 결과:

- `anon` table select: `true`
- 관리자 화면 Supabase 점검 결과: `Supabase 정상`
- 메시지: `Supabase connection is healthy.`

현재 일일 업무일지의 운영 주경로는 여전히 `localStorage + Blob 수동 팀 공유`이며, Supabase는 primary가 아닌 보조/병행 준비 경로이다. 따라서 이번 조치는 운영 일지 저장/가져오기 장애 복구가 아니라, Supabase health check 및 향후 전환 준비를 위한 DB 권한 정리로 기록한다.

### 2026-06-29 저장소 비교 진단 도구 추가

관리자/리더 화면에 읽기 전용 `Blob / Supabase 저장소 비교` 진단 도구를 추가하는 전환 준비를 기록한다.

- 기존 `팀 공유 저장` / `팀 공유본 가져오기` 동작은 유지한다.
- 새 도구는 Blob 팀 공유본과 Supabase `journal_snapshots`를 조회만 하고, 저장/덮어쓰기를 수행하지 않는다.
- 비교 항목은 구성원별 존재 여부, updatedAt, task count, Blob-only / Supabase-only / 차이 여부이다.
- Supabase 조회 실패는 상태 표시만 하고 기존 journal state를 변경하지 않는다.
