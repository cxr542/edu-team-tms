# TMS 접속 URL · 북마크 (운영)

> **운영 사이트:** https://okestro-edu-team-tms.vercel.app  
> (동일 콘텐츠: https://edu-team-tms.vercel.app)  
> 로그인 없음 — **아래 URL을 그대로 북마크**하세요.  
> 마지막 갱신: 2026-06-10  
> **Vercel Blob 중단 중:** 장부·일지 할 일은 [Blob 중단 — 장부·일지 운영](./TMS-Blob중단-장부일지-운영가이드.md) 참고.

---

## 1. 공통 · 역할별 접속

> **2026-06-12 정책:** `member` 없는 `?mode=view` 공개 조회(장부·런치·이것도?·KPI·참고문서)는 **사용 중단**되었습니다. 해당 URL 접속 시 **역할별 접속 안내 화면**만 표시됩니다.

| 상태 | URL 예시 | 비고 |
|------|----------|------|
| **사용 중단** (안내 화면) | `?mode=view` · `?mode=view&module=ledger` · `?mode=view&module=lunch` 등 | member 없음 |
| **공식 — 팀장** | `?mode=edit&access=leader` | 장부 편집·KPI·승인·리포트 등 |
| **공식 — 구성원 일지** | `?mode=edit&module=journal&member=B\|C` | 본인 작성 · **A/B/C 탭**으로 팀원 일지 **조회** (타인 탭은 read-only) |
| **공식 — 구성원 장부 조회** | `?mode=view&module=ledger&member=B\|C&year=2026&month=6` | read-only |

운영 사이트 루트(`/`, `mode` 생략)도 조회 모드로 열리지만, **member 없으면 동일하게 안내 화면**입니다.

---

## 2. 팀장 · 총무 (김윤형 A)

팀장 URL: `?mode=edit&access=leader` — **장부 편집**, 팀 KPI·승인·리포트, **실험 버전(클라우드 챗봇)** 포함.

| 용도 | URL |
|------|-----|
| **팀장 홈 (장부)** | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader |
| 본인 일지 (A) | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=journal |
| 본인 역량 평가 (A) | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=competency&member=A |
| 팀 KPI 관리 | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=kpi |
| KPI 승인 | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=kpi-approve |
| KPI 리포트 | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=kpi-report |
| 점심 뭐 먹지 | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=lunch |
| PPT Academizer | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=academizer |
| 클라우드 챗봇 (실험) | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=cloud-chatbot |
| 참고문서 | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&module=docs |

**역량:** 팀장은 **본인(A) 자체평가 폼만 수정**합니다. B·C **팀장 평가·분기 확정**은 **팀 KPI 관리 → KPI3** 탭에서 진행합니다.

**일지:** 팀장 화면에서 A/B/C 탭 전환 가능(확인·대리 입력). **본인 업무는 A 탭**에서 작성합니다.  
탭을 바꾸면 주소에 `member=B` 등이 붙습니다 — **북마크·공유는 주소창 URL**을 쓰세요.

| 용도 | URL |
|------|-----|
| B 일지 확인·대리 입력 (팀장) | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&member=B&module=journal |
| C 일지 확인·대리 입력 (팀장) | https://okestro-edu-team-tms.vercel.app/?mode=edit&access=leader&member=C&module=journal |

**이 북마크 표**는 `?module=docs&doc=tms-bookmarks` 로 엽니다. `module=journal&doc=…` 는 일지 화면이라 표가 보이지 않습니다.

---

## 3. 팀원 — 최우성 (B · 겸업)

팀원 URL: `?mode=edit&member=B` — **본인 일지·역량 작성**. 장부·점심·이것도?는 **조회·참여** 가능.

**일지:** 화면 상단 **A · B · C** 탭으로 팀원 일지를 **조회**할 수 있습니다. **본인(B) 탭만** 편집·승인 요청 가능하고, 다른 탭에는 **「조회」** 배지가 붙습니다. 타인 일지를 보려면 팀장이 보낸 JSON을 **「조회용 JSON 가져오기」**로 불러오세요 (본인 일지는 변경되지 않음).

| 용도 | URL |
|------|-----|
| **★ 일지 (북마크 권장)** | https://okestro-edu-team-tms.vercel.app/?mode=edit&member=B&module=journal |
| 역량 평가 | https://okestro-edu-team-tms.vercel.app/?mode=edit&member=B&module=competency |
| 팀 빌딩비 장부 (조회) | https://okestro-edu-team-tms.vercel.app/?mode=view&member=B&module=ledger&year=2026&month=6 |
| 점심 뭐 먹지 | https://okestro-edu-team-tms.vercel.app/?mode=edit&member=B&module=lunch |
| 이것도? | https://okestro-edu-team-tms.vercel.app/?mode=edit&member=B&module=idea-bank |

`module` 없이 `?mode=edit&member=B` 만 열면 **일지**로 들어갑니다.

**승인 요청:** 일지 상단 **「팀장 승인 요청」** → KPI1 월 확정·KPI2 효과 건을 팀장 승인 큐에 올립니다.

**타인 일지 조회:** **「조회용 JSON 가져오기」** — 팀장이 보낸 백업 JSON에서 A/C 일지만 반영 (본인 B 일지는 유지).

---

## 4. 팀원 — 신혜윤 (C · 기획/운영)

| 용도 | URL |
|------|-----|
| **★ 일지 (북마크 권장)** | https://okestro-edu-team-tms.vercel.app/?mode=edit&member=C&module=journal |
| 역량 평가 | https://okestro-edu-team-tms.vercel.app/?mode=edit&member=C&module=competency |
| 팀 빌딩비 장부 (조회) | https://okestro-edu-team-tms.vercel.app/?mode=view&member=C&module=ledger&year=2026&month=6 |
| 점심 뭐 먹지 | https://okestro-edu-team-tms.vercel.app/?mode=edit&member=C&module=lunch |
| 이것도? | https://okestro-edu-team-tms.vercel.app/?mode=edit&member=C&module=idea-bank |

**일지:** B와 동일 — **A/B/C 탭 조회**, **C 탭만** 편집.

---

## 5. 사이드바 메뉴 그룹 (2026-06)

| 그룹 | 팀장 | 팀원 (B/C) |
|------|:----:|:----------:|
| 총무·공통 (장부 편집·Academizer·점심) | ✅ | — |
| **팀 공통** (장부 조회·점심·이것도?) | — | ✅ |
| 팀 구성원 업무 (일지·역량) | ✅ | ✅ (본인 작성 · 일지 A/B/C **조회**) |
| **실험 버전** (클라우드 챗봇) | ✅ | ❌ |
| 팀장 업무 (KPI·승인·리포트) | ✅ | ❌ |
| 참고문서 | ✅ | — (팀원 URL) |

---

## 6. PDF로 저장하기

1. TMS **참고문서** → **「TMS 접속 URL · 북마크」** 열기  
2. 브라우저 **인쇄 → PDF로 저장** (Chrome: ⌘P → 대상 PDF)

---

## 7. 데이터 · 주의

- 일지·KPI는 **브라우저 localStorage** + (선택) 클라우드 스냅샷. 기기·브라우저마다 다를 수 있습니다.
- **구성원 일지 조회:** B/C도 A/B/C 탭 전환 가능. 타인 내용은 **「조회용 JSON 가져오기」**로 팀장 백업을 불러옵니다. **본인 탭** 데이터는 import 시 덮어쓰지 않습니다.
- 장부 **조회**는 팀장이 「조회에 반영」한 공개 스냅샷 기준입니다.
- 개발 URL(`localhost`)과 운영 URL 데이터는 **분리**됩니다.

## 관련 문서

- [팀 KPI 메뉴·URL](./KPI-TMS-팀KPI메뉴.md)
- [일지 ↔ TMS 연계 가이드](./KPI-일지-TMS-연계-가이드.md)
