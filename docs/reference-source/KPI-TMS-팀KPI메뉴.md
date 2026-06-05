# TMS 팀 KPI 관리 (v2 · TMS SoT)

교육팀 TMS — **공식 KPI 기록은 TMS** · 엑셀은 분석·백업 export만.

## 메뉴

| 화면 | URL | 역할 |
|------|-----|------|
| 일일 업무일지 | `module=journal` | 구성원별 매일 입력 |
| 역량 평가 (KPI3) | `module=competency` | **4요소**(레벨·다면·리더·실전)·자체/팀장 루브릭·분기 확정 |
| 팀 KPI 관리 | `module=kpi` | **팀장** · KPI1·2·월마감·보내기 |
| KPI 승인 | `module=kpi-approve` | **팀장** 승인·반려 |
| KPI 리포트 | `module=kpi-report` | **팀장** 월·분기 리포트 |
| 클라우드 챗봇 | `module=cloud-chatbot` | **팀장 전용 · 실험** (Render iframe) |

## URL 스코프 (로그인 없이 북마크)

| 대상 | 예시 |
|------|------|
| 김윤형(강사) 팀장 | `?mode=edit&access=leader` |
| 최우성(겸업) | `?mode=edit&member=B&module=journal` |
| 신혜윤(기획/운영) | `?mode=edit&member=C&module=journal` |

**팀원** URL: **팀 구성원 업무**(일지·역량) + **팀 공통**(장부 조회·점심·이것도?). **실험 버전·팀장 업무**는 `access=leader` 필요.

**전체 URL 표:** [TMS-접속URL-북마크.md](./TMS-접속URL-북마크.md)

조회 모드(`mode=view`): 장부 + (설정에 따라) 점심·KPI 승인·KPI 리포트 등.

## 운영 절차

1. **일지**에 업무·실작업 입력 (효과 건 = KPI2 토글)
2. 일지 **「팀장 승인 요청」**에서 KPI1 월 확정·KPI2 효과 건 **승인 요청** (구성원)
3. **역량 평가**에서 KPI3 자체평가 (팀장은 A 본인 폼 + **팀 KPI**에서 B/C 팀장평가)
4. **팀 KPI** → 월마감 **제출** (팀장 대리 가능) · **KPI 승인**에서 승인·반려
5. **KPI 리포트**에서 월·분기 확인
6. 필요 시 **보내기** 탭에서 분석 Excel·스냅샷 JSON

## 동기화

```bash
cd edu-team-tms   # GitHub repo 루트
npm run publish:kpi
npm run publish:journal
# 운영 배포: main 머지 → GitHub Actions (Deploy Production)
```

## 관련 문서

- [TMS-접속URL-북마크.md](./TMS-접속URL-북마크.md) — **구성원별 북마크 URL**
- [KPI-일지-TMS-연계-가이드.md](./KPI-일지-TMS-연계-가이드.md)
- [KPI-TMS-운영모델-v2.md](./KPI-TMS-운영모델-v2.md)
- [pilot-checklist-v2-tms.md](./pilot-checklist-v2-tms.md)
