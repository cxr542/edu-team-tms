# TMS 팀 KPI 관리 (v2 · TMS SoT)

교육팀 TMS — **공식 KPI 기록은 TMS** · 엑셀은 분석·백업 export만.

## 메뉴

| 화면 | URL | 역할 |
|------|-----|------|
| 일일 업무일지 | `module=journal` | 매일 입력 (가동률·생산성 효과) |
| 팀 KPI 관리 | `module=kpi` | 01c·월마감·핵심역량·제출 |
| KPI 승인 | `module=kpi-approve` | 팀장 승인·반려 |
| KPI 리포트 | `module=kpi-report` | 월·분기 리포트·인쇄 |

조회 모드(`mode=view`): 장부 + KPI 승인 + KPI 리포트.

## 운영 절차

1. 일지에 업무·실작업 입력 (효과 건 = KPI2 토글)
2. **팀 KPI** → KPI1 주간메모 · KPI3 · **월마감** → 01c 합 반영 → **제출**
3. **KPI 승인**에서 팀장 승인
4. **KPI 리포트**에서 월·분기 확인
5. 필요 시 **보내기** 탭에서 분석 Excel·스냅샷 JSON

## 동기화

```bash
cd apps/TMS\(Team\ Management\ System\)
npm run publish:kpi    # team-kpi-snapshot.json → public/
npm run publish:journal
npm run deploy:vercel
```

## 관련 문서

- [KPI-일지-TMS-연계-가이드.md](./KPI-일지-TMS-연계-가이드.md) — 일지 상단 KPI 연계·매핑표
- [KPI-TMS-운영모델-v2.md](./KPI-TMS-운영모델-v2.md)
- [pilot-checklist-v2-tms.md](./pilot-checklist-v2-tms.md)
- [KPI-TMS-traceability-tms.md](./KPI-TMS-traceability-tms.md)

## 코드

- [`useKpiOperational.js`](../../TMS(Team%20Management%20System)/src/hooks/useKpiOperational.js)
- [`computeTeamKpi.js`](../../TMS(Team%20Management%20System)/src/utils/computeTeamKpi.js)
- [`kpiExcelExport.js`](../../TMS(Team%20Management%20System)/src/utils/kpiExcelExport.js)
