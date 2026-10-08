# TMS 팀 KPI 관리 (v2 · TMS SoT)

교육팀 TMS — **공식 KPI 기록은 TMS** · 엑셀은 분석·백업 export만.

## 메뉴

| 화면 | URL | 역할 |
|------|-----|------|
| 일일 업무일지 | `module=journal` | 구성원별 매일 입력 · **A/B/C 탭 조회**(타인 read-only) |
| 역량 평가 (KPI3) | `module=competency` | **4요소**(레벨·다면·리더·실전)·자체/팀장 루브릭·분기 확정 |
| 팀 KPI 관리 | `module=kpi` | **팀장** · KPI1·2·월마감·보내기 |
| KPI 승인 | `module=kpi-approve` | **팀장** 승인·반려 |
| KPI 리포트 | `module=kpi-report` | **팀장** 월간·분기·연간 리포트 (`view=monthly\|quarterly\|annual`) |
| 클라우드 챗봇 | `module=cloud-chatbot` | **팀장 전용 · 실험** (Render iframe) |
| 강의일지 | `module=lecture-journal` | **팀 공통** · Confluence 「02. 강의일지 폴더」목록 · 본문은 Confluence |

## URL 스코프 (로그인 없이 북마크)

| 대상 | 예시 |
|------|------|
| 김윤형(강사) 팀장 | `?mode=edit&access=leader` |
| 최우성(겸업) | `?mode=edit&member=B&module=journal` |
| 신혜윤(기획/운영) | `?mode=edit&member=C&module=journal` |

**팀원** URL: **팀 구성원 업무**(일지·역량) + **팀 공통**(장부 조회·점심·이것도?·**강의일지**·**참고문서**). **실험 버전·팀장 업무**는 `access=leader` 필요.

**전체 URL 표:** [TMS 접속 URL · 북마크](./TMS-접속URL-북마크.md)

조회 모드(`mode=view`): 장부 + (설정에 따라) 점심·KPI 승인·KPI 리포트 등.

## KPI 리포트 집계 방식

- **월간**: 선택한 월의 구성원별 ① 업무 리소스 가동률 ② 업무 리소스 생산성 ③ 월별 레벨 평가. 하단 줄은 팀 평균(합계로 계산한 팀 값).
- **분기**: 3개월 추이를 곁들인 구성원별 분기 합산 가동률·생산성, 분기 평가표(레벨 열에 월별 레벨 평가 결과를 함께 표시, 다면·리더·실전, KPI3 종합).
- **연간**: 월간·분기와 같은 ①②③ 구조. 구성원별 분기(1Q~4Q)·연간 합산 가동률·생산성, 분기별 KPI3 종합(레벨 포함)과 연간 KPI3(4분기 종합).
- KPI1·KPI2는 월 값을 평균하지 않고 기간 전체의 분자·분모를 합산해 다시 계산한다
  (KPI1 = Σ(업무+생산향상+휴일 M/D) ÷ Σ가용 M/D, KPI2 = Σ계획시간 ÷ Σ실작업시간, 승인 건 기준이며 승인 전 포함 값은 `*` 표시).
- 연간 KPI3(레벨 포함)는 **4분기(연말)의 확정 종합 점수**를 쓴다. 분기들을 평균하지 않으며, 4분기가 확정 전이면 연간 값은 비어 있다(앞선 분기로 대체하지 않음). 팀 연간은 4분기 팀 종합이다.
- **분기 레벨(KPI3 레벨 35%)**: 분기 **마지막 달**(2분기=6월, 3분기=9월)의 팀장 확정 월 최종 레벨을 반영한다. 마지막 달이 팀장 확정 전이면 반영하지 않으며 이전 달로 대체하지 않는다. 앞선 달의 평균은 쓰지 않는다.
- 이 집계 방식은 정의서에 명시된 규칙이 아니라 리포트·TMS 운영 기준이다.

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

- [TMS 접속 URL · 북마크](./TMS-접속URL-북마크.md) — **구성원별 북마크 URL**
- [KPI-일지-TMS-연계-가이드.md](./KPI-일지-TMS-연계-가이드.md)
- [KPI-TMS-운영모델-v2.md](./KPI-TMS-운영모델-v2.md)
- [pilot-checklist-v2-tms.md](./pilot-checklist-v2-tms.md)
