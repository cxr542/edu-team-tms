# TMS KPI 운영 모델 v2

**시행:** 2026년 6월~ · **SoT:** TMS (`module=kpi`) · **엑셀:** 분석·백업 추출만

## 역할

| 역할 | TMS 화면 | 권한 |
|------|----------|------|
| 구성원 (A/B/C) | 일지 + 팀 KPI | 입력·제출 |
| 총무 | 동일 (`mode=edit`) | 월마감·과제 관리 |
| 팀장 | `module=kpi-approve` · `module=kpi-report` (`mode=view` 가능) | 승인·반려·리포트 |

## 데이터 흐름

1. **일지** → KPI1 M/D·KPI2 효과 건 (구성원 A 일지 = 파일럿 입력원)
2. **KPI 탭** → 주간메모(`kpiWeekMemos`)·월마감(`monthly01`)·KPI3·상태
3. **제출** → 팀장 **승인** 후 집계·리포트에 반영
4. **보내기** → 분석용 xlsx (공식 제출 아님)

## 엑셀과의 관계

| 항목 | v1 | v2 |
|------|----|----|
| 공식 기록 | OneDrive 운영 엑셀 | **TMS** |
| 01c / 01 / 02 / 03 | 수동 붙여넣기 | TMS 저장 → export 시 값 스냅샷 |
| 90_팀장승인 | COUNTIF | TMS 승인 큐 |
| 99_대시보드 | 엑셀 차트 | TMS 리포트 탭 |

## 동기화

- 로컬: `tms-kpi-operational-v1` (localStorage)
- 팀 공유: `public/team-kpi-snapshot.json` (`npm run publish:kpi`)
- 일지 스냅샷과 병행 가능 (`journal-snapshot.json`)
- 월간 역량 평가: `/api/kpi-operational-snapshot` (Blob) — 수동 저장·가져오기. 가져오기는 역량 평가 화면(구성원·팀장)에 들어갈 때 세션당 1회 자동으로도 실행된다(병합 규칙 동일). 저장은 구성원 제출·팀장 확정/확정 취소 시 자동 실행되고, 팀장 화면 진입 시 공유본에 없는 과거 팀장 확정도 한 번 보충 저장한다
- 분기 4요소(다면·리더·실전) 제출·검토·확정: `/api/kpi-operational-snapshot?scope=quarters` (월간 역량과 같은 서버리스 함수, Vercel Hobby 함수 12개 한도 때문. Blob `kpi-operational/quarters-latest.json`) — 「분기 공유 저장」·「분기 공유본 가져오기」 수동 사용, 구성원 제출/취소·팀장 검토/분기 확정 시에는 저장이 자동 실행된다. 또한 구성원 역량 평가 화면(탭 무관) 또는 팀장 분기 평가 화면에 들어갈 때(세션당 1회, 실패 시 토스트 후 다음 진입에서 재시도) 팀장은 공유본을 자동으로 가져오고(구성원 제출분만 갱신, 팀장 입력 유지), 구성원은 공유본에 없는 본인 제출분을 자동으로 보충 저장한다(수동 전용 원칙의 예외). 구성원은 입력·제출만, 팀장은 검토·점수·확정·이의·상위 승인 기록을 쓰며(서버가 요청 경로로 권한 판단), 팀장 메모는 공유하지 않는다.

## 관련 문서

- [KPI-Academizer-TMS-시나리오예시.md](./KPI-Academizer-TMS-시나리오예시.md) — 개발 5일 + 활용 1건 숫자 예시
- [KPI-TMS-traceability-tms.md](./KPI-TMS-traceability-tms.md) — TMS 필드 ↔ 구 엑셀 열
- [KPI-TMS-팀KPI메뉴.md](./KPI-TMS-팀KPI메뉴.md) — 메뉴·URL
- [pilot-checklist-v2-tms.md](./pilot-checklist-v2-tms.md) — 파일럿 v2
