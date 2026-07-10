# TMS 접속 URL · 북마크 (운영)

> **운영 URL:** https://edu-team-tms-ten.vercel.app — 경로 URL(`/admin`, `/yhkim` …), 접속 안내 랜딩, 관리자 비밀번호 게이트, 팀 공유  
> **Preview 일지 팀 공유 SoT:** Supabase (`MANUAL_MIRROR`) — journal Blob POST demote(J7d). Production은 기존 Blob 팀 공유 유지.  
> 로그인 없음 — **아래 §2~§5 URL을 그대로 북마크**하세요.  
> 마지막 갱신: 2026-07-10  
> **옛 URL** (`okestro-edu-team-tms.vercel.app`, `edu-team-tms.vercel.app`) 은 **데이터 origin이 분리**됩니다. 일지 이전은 §9 참고.  
> **예비 hostname** `okestro-edu-tms-v2.vercel.app` — Vercel 도메인 확보 전까지 **미사용**.

---

## 0. 운영 URL (2026-06)

| 구분 | URL | 비고 |
|------|-----|------|
| **현재 운영** | `edu-team-tms-ten.vercel.app` | §2~§5 북마크 · Blob 정상 |
| **옛 URL** | `okestro-edu-team-tms.vercel.app` | Blob suspend · JSON 이전만 |
| **예비 v2** | `okestro-edu-tms-v2.vercel.app` | 도메인 claim 보류 · 미사용 |

전원 **ten URL**로 북마크를 맞추세요. 옛 URL에서 온 데이터는 §9 이전 절차를 따릅니다.

관리자는 `/admin` 비밀번호·`/yhkim`·접속 안내를 미리 점검하세요. 사용자 전환 전 **「팀 공유 저장」**으로 일지 동기화를 맞춰 두세요.

---

## 1. 공통 · 역할별 접속

> **2026-06-12 정책:** `member` 없는 `?mode=view` 공개 조회(장부·런치·이것도?·KPI·참고문서)는 **사용 중단**되었습니다. 해당 URL 접속 시 **역할별 접속 안내 화면**만 표시됩니다.

| 상태 | URL 예시 | 비고 |
|------|----------|------|
| **사용 중단** (안내 화면) | `?mode=view` · `?mode=view&module=ledger` · `?mode=view&module=lunch` 등 | member 없음 |
| **공식 — 관리자** | `/admin` (`?access=admin` 도 동일) | 장부 편집·KPI·승인·리포트 |
| **공식 — 사용자 일지** | `/yhkim` · `/wschoi` · `/hwshin` | 본인 작성 · A/B/C 탭 조회 |
| **공식 — 사용자 장부 조회** | `/wschoi?mode=view&module=ledger&year=2026&month=6` 등 | read-only |

운영 사이트 루트(`/`, `mode` 생략)도 조회 모드로 열리지만, **member 없으면 동일하게 안내 화면**입니다.

---

## 2. 관리자 (장부·KPI·팀 일지)

관리자 URL: `/admin` — **장부 편집**, 팀 KPI·승인·리포트. (구 `?access=admin` · `?access=leader` 는 자동으로 `/admin`으로 정리됩니다.)

| 용도 | URL |
|------|-----|
| **관리자 홈 (장부)** | https://edu-team-tms-ten.vercel.app/admin |
| 팀 일지 | https://edu-team-tms-ten.vercel.app/admin?module=journal |
| KPI 승인 | https://edu-team-tms-ten.vercel.app/admin?module=kpi-approve |
| KPI 리포트 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=admin&module=kpi-report |
| 점심 뭐 먹지 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=admin&module=lunch |
| PPT Academizer | https://edu-team-tms-ten.vercel.app/?mode=edit&access=admin&module=academizer |
| 클라우드 챗봇 (실험) | https://edu-team-tms-ten.vercel.app/?mode=edit&access=admin&module=cloud-chatbot |
| 참고문서 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=admin&module=docs |

**일지:** 관리자 화면에서 A/B/C 탭 전환·대리 입력 가능. **본인 업무 일지는 `/yhkim` 등 사용자 URL** 을 북마크하는 것을 권장합니다.

| 용도 | URL |
|------|-----|
| B 일지 확인·대리 입력 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=admin&member=B&module=journal |
| C 일지 확인·대리 입력 | https://edu-team-tms-ten.vercel.app/?mode=edit&access=admin&member=C&module=journal |

**이 북마크 표**는 `/admin?module=docs&doc=tms-bookmarks` 로 엽니다.

---

## 3. 사용자 — 김윤형 (A · 강사)

| 용도 | URL |
|------|-----|
| **★ 일지 (북마크 권장)** | https://edu-team-tms-ten.vercel.app/yhkim |
| 역량 평가 | https://edu-team-tms-ten.vercel.app/yhkim?module=competency |
| 팀 빌딩비 장부 (조회) | https://edu-team-tms-ten.vercel.app/yhkim?mode=view&module=ledger&year=2026&month=6 |
| 점심 뭐 먹지 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=A&module=lunch |
| 이것도? | https://edu-team-tms-ten.vercel.app/?mode=edit&member=A&module=idea-bank |
| 참고문서 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=A&module=docs |

B/C와 **동일한 사용자 UI**입니다. KPI 승인 요청·향상 과제는 일지 상단 버튼을 사용합니다.

---

## 4. 사용자 — 최우성 (B · 겸업)

팀원 URL: `?mode=edit&member=B` — **본인 일지·역량 작성**. 장부·점심·이것도?는 **조회·참여** 가능.

| 용도 | URL |
|------|-----|
| **★ 일지 (북마크 권장)** | https://edu-team-tms-ten.vercel.app/wschoi |
| 역량 평가 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=competency |
| 팀 빌딩비 장부 (조회) | https://edu-team-tms-ten.vercel.app/?mode=view&member=B&module=ledger&year=2026&month=6 |
| 점심 뭐 먹지 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=lunch |
| 이것도? | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=idea-bank |
| 참고문서 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=B&module=docs |

`module` 없이 `?mode=edit&member=B` 만 열면 **일지**로 들어갑니다.

**승인 요청:** 일지 상단 **「KPI 승인 요청」** 버튼 → KPI1 월 확정·KPI2 효과 건을 관리자 승인 큐에 올립니다.

**팀 공유:** 본인(B) 탭에서 일지 작성 후 **「팀 공유 저장」**. 타인(A/C) 일지는 **A · C 탭**에서 **조회** — 비어 있으면 **「팀 공유본 가져오기」**(본인 일지는 유지, 타인만 갱신). JSON 백업·**「조회용 JSON 가져오기」**는 예비 수단입니다.

---

## 5. 사용자 — 신혜윤 (C · 기획/운영)

| 용도 | URL |
|------|-----|
| **★ 일지 (북마크 권장)** | https://edu-team-tms-ten.vercel.app/hwshin |
| 역량 평가 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=competency |
| 팀 빌딩비 장부 (조회) | https://edu-team-tms-ten.vercel.app/?mode=view&member=C&module=ledger&year=2026&month=6 |
| 점심 뭐 먹지 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=lunch |
| 이것도? | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=idea-bank |
| 참고문서 | https://edu-team-tms-ten.vercel.app/?mode=edit&member=C&module=docs |

**일지:** B와 동일 — **A/B/C 탭 조회**, **C 탭만** 편집. 작성 후 **「팀 공유 저장」**, 타인 조회는 **「팀 공유본 가져오기」**.

---

## 6. 사이드바 메뉴 그룹 (2026-06)

| 그룹 | 관리자 | 사용자 (A/B/C) |
|------|:------:|:--------------:|
| 관리·공통 (장부 편집·Academizer·점심) | ✅ | — |
| **팀 공통** (장부 조회·점심·이것도?) | — | ✅ |
| **사용자 업무** (일지·역량) | ✅ (팀 전체) | ✅ (본인 작성 · 일지 A/B/C **조회**) |
| **실험 버전** (클라우드 챗봇) | ✅ | ❌ |
| **관리 업무** (KPI·승인·리포트) | ✅ | ❌ |
| 참고문서 | ✅ | ✅ |

---

## 7. PDF로 저장하기

1. TMS **참고문서** → **「TMS 접속 URL · 북마크」** 열기  
2. 브라우저 **인쇄 → PDF로 저장** (Chrome: ⌘P → 대상 PDF)

---

## 8. 데이터 · 주의

- **URL마다 데이터가 분리**됩니다. `okestro-edu-team-tms` 에 쓴 일지는 `edu-team-tms-ten` 에 **자동으로 안 넘어옵니다.**
- 일지·KPI는 **브라우저 localStorage** + (운영) **클라우드 팀 공유**. 기기·브라우저마다 다를 수 있습니다.
- **구성원 일지 조회:** B/C도 A/B/C 탭 전환 가능. 타인 내용은 **「팀 공유본 가져오기」**로 갱신(본인 슬라이스 유지). 팀장·팀원 모두 **「팀 공유 저장」**으로 각자 일지를 올립니다.
- 장부 **조회**는 팀장이 **「지금 조회에 반영」** 한 공개 스냅샷 기준입니다.
- `localhost` 개발 URL과 운영 URL 데이터는 **분리**됩니다.

---

## 9. 이전 URL에서 일지 가져오기

요약만 적습니다. **상세·파일럿·Blob·역할별 UI**는 [운영 URL 이전 가이드](./TMS-운영URL-이전-가이드.md)를 따르세요.

| 누가 | 어디서 | 어떻게 |
|------|--------|--------|
| **팀장** | **옛 URL** `/admin` 일지 | **백업용 JSON 다운로드** → **ten** **백업 가져오기** → A 탭 **팀 공유 저장** |
| **팀장** | ten에 이미 최신 | JSON 이전 **생략** → **팀 공유 저장**만 |
| **팀장** | **옛 URL** `/admin` 장부 | **장부 JSON 백업** → ten **장부 백업 가져오기** → **지금 조회에 반영** |
| **팀원 B/C** | **본인 기기·옛 URL** | JSON → **팀장 전달** → 팀장 ten **백업 가져오기** (또는 ten에서 새로 작성) |
| 팀원 (일상) | **ten** | **팀 공유 저장** · 타인 **팀 공유본 가져오기** |

## 관련 문서

- [운영 URL 이전 가이드](./TMS-운영URL-이전-가이드.md)
- [팀 KPI 메뉴·URL](./KPI-TMS-팀KPI메뉴.md)
- [일지 ↔ TMS 연계 가이드](./KPI-일지-TMS-연계-가이드.md)

## TMS에서 열기

`/admin?module=docs&doc=tms-bookmarks`
