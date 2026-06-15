# TMS 접속 URL · 북마크 (운영)

> **운영 사이트 (2026-06-15~):** https://edu-team-tms-ten.vercel.app  
> 로그인 없음 — **아래 URL을 그대로 북마크**하세요.  
> 마지막 갱신: 2026-06-15  
> **이전 URL** (`okestro-edu-team-tms.vercel.app`) 은 **더 이상 쓰지 마세요.** 데이터는 자동 이전되지 않습니다 → [운영 URL 이전 가이드](./TMS-운영URL-이전-가이드.md)

---

## 0. 파일럿 단계 (안정화 전)

| 단계 | 누가 | 할 일 |
|------|------|--------|
| **1 — 지금** | **팀장(A)만** | 아래 §2 팀장 URL로 장부·일지·KPI 운영. Blob **팀 공유 저장**으로 시드 |
| **2 — 안정화 후** | **B/C** | 팀장 안내 후 §3·§4 URL로 전환 · 본인 일지 **팀 공유 저장** |

구성원은 **팀장이 「이전 시작」을 알릴 때까지** 옛 URL·기존 북마크를 써도 됩니다. 팀장이 먼저 새 URL에서 일지·향상 과제·장부를 맞춰 두면, 구성원은 **팀 공유본 가져오기**만으로 동기화할 수 있습니다.

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
| **팀장 홈 (장부)** | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader |
| 본인 일지 (A) | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=journal |
| 본인 역량 평가 (A) | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=competency&member=A |
| 팀 KPI 관리 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=kpi |
| KPI 승인 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=kpi-approve |
| KPI 리포트 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=kpi-report |
| 점심 뭐 먹지 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=lunch |
| PPT Academizer | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=academizer |
| 클라우드 챗봇 (실험) | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=cloud-chatbot |
| 참고문서 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&module=docs |

**역량:** 팀장은 **본인(A) 자체평가 폼만 수정**합니다. B·C **팀장 평가·분기 확정**은 **팀 KPI 관리 → KPI3** 탭에서 진행합니다.

**일지:** 팀장 화면에서 A/B/C 탭 전환 가능(확인·대리 입력). **본인 업무는 A 탭**에서 작성합니다.  
탭을 바꾸면 주소에 `member=B` 등이 붙습니다 — **북마크·공유는 주소창 URL**을 쓰세요.

| 용도 | URL |
|------|-----|
| B 일지 확인·대리 입력 (팀장) | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&member=B&module=journal |
| C 일지 확인·대리 입력 (팀장) | https://edu-team-tms-ten.vercel.app/?mode=edit&access=leader&member=C&module=journal |

**일지 팀 공유 (새 운영):** 작성 후 **「팀 공유 저장」** (구성원 탭마다). 팀원·다른 PC는 **「팀 공유본 가져오기」**. 자동 동기화는 없습니다.

**이 북마크 표**는 `?module=docs&doc=tms-bookmarks` 로 엽니다.

---

## 3. 팀원 — 최우성 (B · 겸업)

팀원 URL: `?mode=edit&member=B` — **본인 일지·역량 작성**. 장부·점심·이것도?는 **조회·참여** 가능.

**일지:** 화면 상단 **A · B · C** 탭으로 팀원 일지를 **조회**할 수 있습니다. **본인(B) 탭만** 편집·승인 요청 가능하고, 다른 탭에는 **「조회」** 배지가 붙습니다.

| 용도 | URL |
|------|-----|
| **★ 일지 (북마크 권장)** | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=journal |
| 역량 평가 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=competency |
| 팀 빌딩비 장부 (조회) | https://edu-team-tms-ten.vercel.app/?mode=view&member=B&module=ledger&year=2026&month=6 |
| 점심 뭐 먹지 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=lunch |
| 이것도? | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=idea-bank |
| 참고문서 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=docs |

`module` 없이 `?mode=edit&member=B` 만 열면 **일지**로 들어갑니다.

**승인 요청:** 일지 상단 **「팀장 승인 요청」** → KPI1 월 확정·KPI2 효과 건을 팀장 승인 큐에 올립니다.

**팀 공유:** 본인(B) 탭에서 일지 작성 후 **「팀 공유 저장」**. 타인(A/C) 일지는 **A · C 탭**에서 **조회** — 비어 있으면 **「팀 공유본 가져오기」**(본인 일지는 유지, 타인만 갱신). JSON 백업·**「조회용 JSON 가져오기」**는 예비 수단입니다.

---

## 4. 팀원 — 신혜윤 (C · 기획/운영)

| 용도 | URL |
|------|-----|
| **★ 일지 (북마크 권장)** | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=journal |
| 역량 평가 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=competency |
| 팀 빌딩비 장부 (조회) | https://edu-team-tms-ten.vercel.app/?mode=view&member=C&module=ledger&year=2026&month=6 |
| 점심 뭐 먹지 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=lunch |
| 이것도? | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=idea-bank |
| 참고문서 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=docs |

**일지:** B와 동일 — **A/B/C 탭 조회**, **C 탭만** 편집. 작성 후 **「팀 공유 저장」**, 타인 조회는 **「팀 공유본 가져오기」**.

---

## 5. 사이드바 메뉴 그룹 (2026-06)

| 그룹 | 팀장 | 팀원 (B/C) |
|------|:----:|:----------:|
| 총무·공통 (장부 편집·Academizer·점심) | ✅ | — |
| **팀 공통** (장부 조회·점심·이것도?) | — | ✅ |
| 팀 구성원 업무 (일지·역량) | ✅ | ✅ (본인 작성 · 일지 A/B/C **조회**) |
| **실험 버전** (클라우드 챗봇) | ✅ | ❌ |
| 팀장 업무 (KPI·승인·리포트) | ✅ | ❌ |
| 참고문서 | ✅ | ✅ |

---

## 6. PDF로 저장하기

1. TMS **참고문서** → **「TMS 접속 URL · 북마크」** 열기  
2. 브라우저 **인쇄 → PDF로 저장** (Chrome: ⌘P → 대상 PDF)

---

## 7. 데이터 · 주의

- **URL마다 데이터가 분리**됩니다. `okestro-edu-team-tms` 에 쓴 일지는 `edu-team-tms-ten` 에 **자동으로 안 넘어옵니다.**
- 일지·KPI는 **브라우저 localStorage** + (운영) **클라우드 팀 공유**. 기기·브라우저마다 다를 수 있습니다.
- **구성원 일지 조회:** B/C도 A/B/C 탭 전환 가능. 타인 내용은 **「팀 공유본 가져오기」**로 갱신(본인 슬라이스 유지). 팀장·팀원 모두 **「팀 공유 저장」**으로 각자 일지를 올립니다.
- 장부 **조회**는 팀장이 **「지금 조회에 반영」** 한 공개 스냅샷 기준입니다.
- `localhost` 개발 URL과 운영 URL 데이터는 **분리**됩니다.

---

## 8. 이전 URL에서 일지 가져오기

요약만 적습니다. 상세는 [운영 URL 이전 가이드](./TMS-운영URL-이전-가이드.md).

| 누가 | 어디서 | 어떻게 |
|------|--------|--------|
| **팀장** | **옛 URL** 일지 화면 | **백업용 JSON 다운로드** → **새 URL**에서 **백업 가져오기** → A/B/C 각각 **팀 공유 저장** |
| **팀장** | **옛 URL** 장부 (`?mode=edit&access=leader`) | **장부 JSON 백업 다운로드** → **새 URL** **장부 JSON 백업 가져오기** → **지금 조회에 반영** |
| **팀원 B/C** | **본인이 쓰던 브라우저·옛 URL** | JSON 다운로드 → **새 URL** **백업 가져오기** → 이후 **본인 탭**에서 **팀 공유 저장** |
| 팀원 (일상 공유) | **새 URL** | 본인 **팀 공유 저장** · 타인 조회 **팀 공유본 가져오기** |

## 관련 문서

- [운영 URL 이전 가이드](./TMS-운영URL-이전-가이드.md)
- [팀 KPI 메뉴·URL](./KPI-TMS-팀KPI메뉴.md)
- [일지 ↔ TMS 연계 가이드](./KPI-일지-TMS-연계-가이드.md)

## TMS에서 열기

`?mode=edit&access=leader&module=docs&doc=tms-bookmarks`
