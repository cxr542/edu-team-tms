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
- `member_journals`
- `competency_months`
- `competency_quarters`
- `approval_events`

초기 단계에서는 스냅샷 저장 방식으로 시작하고, 이후 항목 단위 저장으로 분리한다.

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

