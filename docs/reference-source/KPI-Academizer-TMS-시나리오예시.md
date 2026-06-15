# PPT-Academizer × TMS KPI 시나리오 예시

**목적:** 개발 투자(업무 리소스 가동률·생산향상 M/M)와 도구 활용(KPI2 효과)이 TMS에 어떻게 찍히는지 숫자로 확인한다.  
**데이터:** TMS `journalSeedAcademizerScenario.js` — 일지 **「샘플로 되돌리기」** 후 2026년 6월을 연다.

## 일지 입력 요약

| 기간 | 일지 내용 | M/M 축 | KPI2 효과 |
|------|-----------|--------|-----------|
| 6/8(월)~6/12(금) | `PPT-Academizer 개발` · 계획·실적 각 **2h/일** | **생산향상** (`mmAxis: improve`) | **OFF** |
| 6/16(월) | `PPT 신규 작성 (Academizer, 20장)` · 계획 8h · 실적 **5h** | 업무(교육준비) | **ON** · 과제 `ppt-academizer` · 기준 **8h** |

## TMS 화면에서 기대값

### 2주차(6월 w2) — 개발만 (6/8~6/12)

- **일지:** 해당 주 월~금에 개발 항목만 2h씩 → 일별 생산향상 M/M 약 **0.25** (2÷8).
- **팀 KPI → 업무 리소스 가동률:** 해당 주 **생산향상MM** 합 ≈ **1.25** (0.25×5). 업무 MM은 0에 가깝다.
- **팀 KPI → 업무 리소스 생산성:** 개발 건은 **효과 행에 안 나옴** (`kpi2Effect` 없음). KPI2 탭은 **—** 또는 효과 건 0건.

### 3주차(6월 w3) — 활용 1건 (6/16)

- **팀 KPI → 업무 리소스 생산성:** 효과 행 1건  
  - 기준 8h · 실작업 5h → **160%** (8÷5)  
  - **개요 큰 숫자** = 승인된 건만. 샘플 되돌리기 시 6/16 건은 **데모 승인**까지 넣어 개요에 바로 표시됩니다.  
  - 이미 일지만 넣은 경우: `module=kpi-approve`에서 승인하거나, 일지에서 **샘플로 되돌리기**를 다시 실행하세요.
- **6월 월간 미리보기:** 6/1 데모(법인카드·KPI시스템·Academizer 효과)와 합치면 효과 건이 2건일 수 있음 → 월 생산성은 **가중 합** (Σ기준÷Σ실작업).

## KPI1 vs KPI2 구분 (기억용)

| 구분 | Academizer **개발** 2h×5일 | Academizer **활용** PPT 1건 |
|------|---------------------------|------------------------------|
| KPI 라벨 | 업무 리소스 가동률 | 업무 리소스 생산성 |
| 집계 | 생산향상 M/M | `kpi2Effect.enabled` 행만 |
| 리포트·분석 | 일지 KPI 스트립 · **KPI 리포트** | 팀 KPI **보내기** (Excel) |

## 확인 URL

- 일지: `http://localhost:3000/?mode=edit` → 2026년 6월
- 팀 KPI: `http://localhost:3000/?mode=edit&module=kpi` → 2026년 6월 · KPI1/KPI2 탭

## 로컬에 예전 일지가 있을 때

브라우저 `localStorage`에 일지가 있으면 시드가 자동 덮어쓰이지 않는다.

1. **일지** (`?mode=edit`, 조회 모드가 아님) 상단 **「샘플로 되돌리기」** (백업 가져오기 옆) → 확인
2. 자동으로 **2026년 6월**로 이동 — 6/8~12 개발, 6/16 활용 확인
3. 대안: 개발자 도구에서 `tms-weekly-journal-v1` 삭제 후 새로고침 (첫 방문 시에만 시드 자동 적용)

## 관련 코드

- `apps/TMS(Team Management System)/src/data/journalSeedAcademizerScenario.js`
- `apps/TMS(Team Management System)/src/utils/computeTeamKpi.js` — `isKpi2EffectTask`, `buildKpi02EffectRows`
