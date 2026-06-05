# TMS KPI 운영 모델 v2

**시행:** 2026년 6월~ · **SoT:** TMS (`module=kpi`) · **엑셀:** 분석·백업 추출만

## 역할

| 역할 | TMS 화면 | 권한 |
|------|----------|------|
| 구성원 (A/B/C) | 일지 + 팀 KPI | 입력·제출 |
| 총무 | 동일 (`mode=edit`) | 월마감·과제 관리 |
| 팀장 | `module=kpi-approve` · `module=kpi-report` (`mode=view` 가능) | 승인·반려·리포트 |

## 데이터 흐름

1. **일지** → KPI1 M/M·KPI2 효과 건 (구성원 A 일지 = 파일럿 입력원)
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

## 관련 문서

- [KPI-Academizer-TMS-시나리오예시.md](./KPI-Academizer-TMS-시나리오예시.md) — 개발 5일 + 활용 1건 숫자 예시
- [KPI-TMS-traceability-tms.md](./KPI-TMS-traceability-tms.md) — TMS 필드 ↔ 구 엑셀 열
- [KPI-TMS-팀KPI메뉴.md](./KPI-TMS-팀KPI메뉴.md) — 메뉴·URL
- [pilot-checklist-v2-tms.md](./pilot-checklist-v2-tms.md) — 파일럿 v2
