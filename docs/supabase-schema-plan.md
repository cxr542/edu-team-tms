# Supabase Schema Plan

## 목적

이 문서는 EDU-TMS의 Supabase 전환을 위한 초기 DB 스키마 방향을 정의한다.

이번 단계의 목표는 실제 앱 저장 로직을 변경하는 것이 아니라, 후속 병행 저장 작업을 위한 테이블 구조와 마이그레이션 방향을 정리하는 것이다.

## 전환 원칙

- 기존 localStorage 저장 흐름은 유지한다
- 기존 Blob 저장/복구 흐름은 유지한다
- Supabase는 처음부터 단일 진실 공급원으로 사용하지 않는다
- 초기에는 스냅샷 저장 방식으로 시작한다
- 안정화 후 항목 단위 테이블로 분리한다
- 승인/반려/확정 상태는 timestamp만 보지 않고 상태 우선순위를 함께 고려한다

## 초기 테이블

### journal_snapshots

업무일지 데이터를 구성원 단위 스냅샷으로 저장한다.

주요 컬럼:

- `id`
- `member_code`
- `payload`
- `payload_version`
- `updated_at`
- `created_at`

사용 목적:

- 구성원별 업무일지 최신본 저장
- localStorage와 Supabase 병행 저장
- Blob 백업 이전의 클라우드 최신본 기준 제공

### kpi_operational_snapshots

KPI/역량 평가 운영 데이터를 팀 단위 스냅샷으로 저장한다.

주요 컬럼:

- `id`
- `scope`
- `payload`
- `payload_version`
- `updated_at`
- `created_at`

사용 목적:

- KPI 승인/반려 상태 저장
- 역량 평가 월별/분기별 상태 저장
- 관리자 화면과 구성원 화면 간 최신 상태 공유

### kpi_monthly_approvals

KPI1 월 확정 승인 상태를 구성원·월 단위 행으로 저장한다.

주요 컬럼:

- `member_code`
- `year_month`
- `status`
- `submitted_at`
- `approved_at`
- `approver`
- `reject_reason`
- `monthly01`
- `payload_version`
- `updated_at`
- `created_at`

사용 목적:

- KPI1 월 확정 승인/반려 상태의 중앙 저장
- localStorage `months[ym][memberCode].monthly01` 구조와 1:1 변환
- 후속 병행 저장/조회에서 월별 승인 상태를 독립적으로 읽기

### kpi2_row_approvals

KPI2 효과 건 승인 상태를 구성원·일자·작업 단위 행으로 저장한다.

주요 컬럼:

- `member_code`
- `day_key`
- `task_id`
- `status`
- `submitted_at`
- `approved_at`
- `approver`
- `reject_reason`
- `kpi2_row_status`
- `payload_version`
- `updated_at`
- `created_at`

사용 목적:

- KPI2 행별 승인/반려 상태의 중앙 저장
- localStorage `kpi2RowStatus[member|day|task]` 구조와 1:1 변환
- 후속 병행 저장/조회에서 행별 승인 상태를 독립적으로 읽기

### sync_events

동기화 이벤트 로그를 저장한다.

주요 컬럼:

- `id`
- `source`
- `member_code`
- `event_type`
- `payload`
- `created_at`

사용 목적:

- 저장/불러오기/충돌/복구 이벤트 추적
- 운영 중 데이터 꼬임 원인 분석
- 후속 자동 병합 로직 검증

## 후속 분리 후보 테이블

초기 스냅샷 방식이 안정화되면 다음 테이블로 분리한다.

- `member_journals`
- `weekly_tasks`
- `monthly_kpi_01`
- `kpi_monthly_approvals`
- `kpi2_row_approvals`
- `csr_requests`
- `kpi_approval_events`
- `competency_months`
- `competency_quarters`
- `quarter_review_events`

## 충돌 처리 기준

기본 원칙:

1. `updated_at`이 더 최신인 데이터를 우선한다
2. 승인/반려/확정 상태는 상태 rank를 우선한다
3. 동일 rank에서는 timestamp를 비교한다
4. 비정상 또는 누락된 timestamp는 자동 덮어쓰기하지 않는다
5. 불확실한 경우 충돌 상태로 남기고 사용자가 선택하게 한다

## RLS 방향

이번 SQL 초안에서는 RLS를 활성화하고, 현재 1단계 병행 저장을 위한 draft select/insert/update policy만 둔다. 실제 production write policy는 후속 PR에서 인증 전략을 확정한 뒤 더 좁게 설계한다.

후속 PR에서 인증 전략을 확정한 뒤 다음 정책을 설계한다.

- 구성원은 본인 데이터만 읽기/쓰기 가능
- 관리자는 팀 전체 데이터 읽기/쓰기 가능
- 공개 조회 링크는 write 권한 없음
- sync event는 제한적 insert만 허용

## 단계별 적용 계획

### 1단계. 스키마 초안

- `supabase/schema.sql` 추가
- 스키마 문서 추가
- 앱 저장 로직 변경 없음

### CSR 요청 게시판

- `csr_requests` 테이블은 `이것도` 메뉴의 운영용 요청 게시판 MVP 저장소다.
- 초기 정책은 `select/insert/update` draft policy만 둔다.
- 삭제는 이번 초안에 포함하지 않는다.

### 2단계. Supabase 연결 상태 점검

- 환경변수 존재 여부 확인
- 연결 가능 여부만 진단
- 저장 로직 변경 없음

### 3단계. 업무일지 병행 저장

- localStorage 저장 유지
- 업무일지 스냅샷을 Supabase에 병행 저장
- 실패해도 localStorage 저장은 유지

### 4단계. KPI 운영 데이터 병행 저장

- `tms-kpi-operational-v1` 스냅샷은 유지한다
- KPI1 월 승인과 KPI2 행 승인은 row table에 1:1 병행 저장
- 승인/반려/확정 이벤트 충돌 기준 추가

### 5단계. 최신본 불러오기

- localStorage와 Supabase의 `updated_at` 비교
- 최신본 선택 또는 충돌 안내

### 6단계. Blob 역할 축소

- Blob은 백업/복구 용도로 유지
- 기본 클라우드 최신본은 Supabase로 이동

## 운영 검증 체크리스트

- SQL이 Supabase SQL Editor에서 실행 가능한가
- RLS가 활성화되어 있는가
- 앱 build/test가 기존처럼 통과하는가
- 기존 localStorage 저장이 깨지지 않는가
- 기존 Blob 저장/복구가 깨지지 않는가
- 환경변수가 없어도 앱이 정상 동작하는가
