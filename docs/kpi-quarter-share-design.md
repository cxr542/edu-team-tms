# KPI3 분기 4요소 제출 공유 저장 — 설계안 (초안)

> 상태: 제안. 승인 전 구현 없음. Blob 쓰기 API 신설을 포함하므로 AGENTS.md상 **명시 승인 필수**.

## 1. 문제

- 구성원이 제출한 분기 4요소(다면 `dmDetail`, 리더 `leaderDetail`, 실전 `practiceDetail`)는 **제출자 브라우저 localStorage(`tms-kpi-operational-v1`의 `quarters`)** 에만 저장된다.
- 월간 역량 평가(`competencyMonths`)만 `/api/kpi-operational-snapshot`(Blob `kpi-operational/live-latest.json`)로 공유된다.
- 결과: 팀장 화면(예: 신혜윤 2026-3Q)에서 제출 상태가 "제출 전"으로 보이고, 승인/반영 작업을 할 수 없다.
- 현재 우회: 「보내기」 JSON 수동 전달 (정상 경로로 보기 어려움, 덮어쓰기 위험).

## 2. 목표 / 비목표

목표
1. 구성원이 제출하면 팀장이 자기 브라우저에서 즉시(새로고침/가져오기) 확인.
2. 팀장 승인·반려·점수 반영 결과가 구성원에게 되돌아감.
3. 기존 월간 역량 공유 방식과 동일한 운영 규칙(수동 저장·수동 가져오기, 자동 동기화 없음).

비목표
- 실시간 동기화, 계산식·등급 로직 변경, 기존 localStorage 데이터 이전·삭제.

## 3. 공유 대상 (필드 소유권)

분기 레코드 `quarters[yq][memberCode]` 중 아래만 공유 슬라이스로 올린다.

| 필드 | 쓰는 사람 | 비고 |
|---|---|---|
| `dmDetail` 입력·제출 상태 | 구성원 | 제출/취소 |
| `leaderDetail` 팀원 자체평가 | 구성원 | 40% 구성 |
| `leaderDetail` 팀장 평가 | 팀장 | 60% 구성 |
| `practiceDetail` | 구성원 제출 / 팀장 승인 | |
| 검토 상태 (`submissionStatus`, 승인/반려, 사후 반려) | 팀장 | 승인 생략 정책과 호환 |
| `quarter` 점수·확정 (`level/dm/leader/practice/composite/grade/locked/confirmedAt/noticedAt`) | 팀장 | 구성원은 읽기만 |
| `appeals`, `execApproval` | 팀장 | 기록 전용 |
| `memos` | 팀장 | 비공유 권장(구성원에게 노출 금지) → **제외** |

원칙: **필드 소유자만 해당 슬라이스를 덮어쓴다.** 구성원 POST는 구성원 소유 필드만, 팀장 POST는 팀장 소유 필드만 병합한다(서버에서 강제).

## 4. 저장소·API

### 안 A (권장): Blob 신규 경로, 기존 패턴 복제
- 경로: `kpi-operational/quarters-latest.json` (월간과 분리해 영향 범위 격리)
- `api/kpi-quarter-snapshot.js`: GET(전체) / POST(`{memberCode, yearQuarter, slice, updatedAt}`)
- 권한: 기존 `canWriteMember` 재사용 (구성원 URL 본인 또는 관리자 세션)
- 병합: 서버가 현재본을 읽고 **회원×분기×섹션 단위 `updatedAt` 비교** 후 병합(더 새로운 쪽 채택, 소유 필드 외 거부)
- 장점: 검증된 구조, Supabase 의존 없음. 단점: 단일 JSON read-modify-write → 동시 제출 시 경합(§6).

### 안 B: Supabase 테이블
- 승인(KPI1/2)은 이미 Supabase mirror(`kpiOperationalSupabaseMirror.js`) 사용 중. `kpi3_quarter_sections` 테이블(키: `yq, member, section`)로 행 단위 upsert → 경합 없음.
- 단점: 스키마/RLS 신설, 로컬 개발·배포 환경 변수 추가, 운영 DB 변경 승인 필요.

권장: **안 A로 시작**(승인 범위가 Blob 1경로로 작고 되돌리기 쉬움). 경합이 실제 문제가 되면 안 B로 이전.

## 5. 클라이언트 변경

1. `src/utils/kpiQuarterCloudSnapshot.js` (신규): normalize/merge/saveable 판정, 소유 필드 화이트리스트.
2. `useKpiOperational`: `saveKpi3QuarterToCloud(memberCode, yq)`, `pullKpi3QuartersFromCloud()` — `mergeKpi3QuartersIntoStore`는 **로컬 쪽 더 새로운 섹션은 보존**(월간 병합 규칙과 동일).
3. UI (`Kpi3ElementsPanel`):
   - 구성원: 「제출」 시 로컬 저장 후 클라우드 저장을 이어서 실행, 실패 시 토스트로 명시(조용히 실패 금지 — hyshin 사례 교훈).
   - 팀장: 「팀 공유본 가져오기」 버튼(분기 4요소 포함)으로 pull. 가져온 건수·최신 `updatedAt` 표시.
   - 상태 라벨에 "마지막 공유 시각" 표시해 "제출 전"과 "공유본 없음"을 구분.
4. 읽기 전용 관리자 화면에서는 pull만, push 금지.

## 6. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 동시 POST로 한쪽 유실 | 서버 병합 + 응답으로 병합본 반환·클라이언트 재병합, 실패 시 재시도 1회. 심하면 안 B |
| 구성원 로컬이 팀장 확정 결과를 덮어씀 | 확정/승인/점수 필드는 구성원 POST에서 거부 |
| 승인 생략(2026-07~) 정책 | `effectiveKpiStatus`류 파생 계산은 클라이언트 유지, 저장값은 그대로 |
| 기존 로컬 전용 데이터 | 자동 이전 없음. 구성원이 「공유 저장」을 눌러 올림(수동) |
| 개인정보 | Blob `access: public`(기존 방식) — 분기 점수·평가 서술이 URL 추측으로 노출되지 않도록 **경로 비공개성 한계 확인 필요**. 서술형 필드는 제외하거나 비공개 접근 검토 |
| 운영 데이터 오염 | 구현·테스트는 목 Blob/로컬로만, 운영 쓰기 테스트는 승인 후 1건 |

## 7. 단계

1. 설계 승인 (Blob 신규 경로 / 공개 접근 이슈 결정)
2. 순수 유틸 + 단위 테스트(병합·소유권 거부·updatedAt 충돌)
3. API + 서버 테스트(권한, 빈 레코드, 읽기 실패 시 저장 중단)
4. 훅·UI 연결, 실패 토스트
5. 정의서/운영모델 문서(SoT: `KPI-TMS-운영모델-v2.md`, 북마크·릴리즈노트) 갱신
6. 배포 후 신혜윤 3Q 실데이터는 본인이 「공유 저장」으로 올린 뒤 팀장 pull로 확인

## 8. 결정 필요 사항

1. 안 A(Blob) vs 안 B(Supabase)
2. 서술형 평가 텍스트를 공유 대상에 포함할지 (공개 Blob 노출 우려)
3. 팀장 `memos` 제외 확정 여부
4. 구성원 제출 시 클라우드 저장 자동 실행 vs 별도 버튼 (월간은 수동 저장)
5. 3Q 마감 일정상 우선순위 — 급하면 임시로 「보내기」 JSON 수동 전달 절차를 먼저 안내
