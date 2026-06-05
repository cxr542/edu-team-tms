# TMS KPI 필드 ↔ 엑셀 매핑 (v2)

기준: [traceability.md](./traceability.md) · SoT = TMS

## KPI1

| TMS 필드 | 구 엑셀 | 비고 |
|----------|---------|------|
| `kpiWeekMemos[weekKey]` | `01c` 주간메모 | 일지 금주와 분리 |
| `months[ym][code].monthly01.work/improve/leave` | `01` E,F,G | 01c 합 자동 + 편집 |
| `months[ym][code].monthly01.available` | `01` H | |
| `month01cTotals` (파생) | `01` P,Q,R | 검증용 |
| `monthly01.utilization` (파생) | `01` J | |
| `monthly01.status` | `01` 상태 | 작성중/제출/승인/반려 |

## KPI2

| TMS 필드 | 구 엑셀 | 비고 |
|----------|---------|------|
| 일지 `kpi2Effect` + `kpi2RowStatus` | `02` 행 | 효과 건만 |
| `status` | `02` 상태 | 승인 후 집계 |

## KPI3

| TMS 필드 | 구 엑셀 | 비고 |
|----------|---------|------|
| `quarters[yq][code].memos[]` | `03` 상단 | type + text |
| `quarters[yq][code].quarter.*` | `03` 분기확정 D~I | 4요소+종합 |
| `quarter.grade` (파생) | `00_기준설정` KPI3 등급 | |

## 승인·리포트

| TMS | 구 엑셀 |
|-----|---------|
| `module=kpi-approve` | `90_팀장승인` |
| `module=kpi-report` | `99_대시보드` + 집계 시트 |
