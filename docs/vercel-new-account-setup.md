# Vercel 새 계정 연결 — Blob 한도 우회 (임시)

> **목적:** 기존 Vercel 팀에서 Blob **연산 한도 초과(suspend)** 가 난 경우, **새 Vercel 계정(팀)** 에 프로젝트를 올려 **새 Hobby 한도**로 Blob을 다시 쓰기.  
> **주의:** 사용 패턴을 바꾸지 않으면 **다시 막힐 수 있음** (이전: Advanced ops 181K/월). Pro·R2 이전·JSON 운영이 장기 해법.

## 요약 체크리스트

- [ ] 새 Vercel 계정(또는 개인 팀) 생성
- [ ] GitHub `cxr542/edu-team-tms` Import → 프로젝트 배포
- [ ] Storage → **Blob** 생성 → 프로젝트 연결 → **Redeploy**
- [ ] 환경 변수 복사 (`KAKAO_REST_API_KEY`, `LEDGER_PUBLISH_SECRET` 등)
- [ ] (권장) `VITE_TMS_ORIGIN` = 새 운영 URL
- [ ] 「지금 조회에 반영」 POST 테스트
- [ ] 팀 북마크 URL 갱신 ([TMS 접속 URL](./reference-source/TMS-접속URL-북마크.md))

---

## 1. 새 Vercel 계정 준비

1. https://vercel.com/signup — **기존 팀과 다른** 이메일/팀 사용
2. **Add New… → Project** → GitHub `edu-team-tms` 연결
3. Framework: **Vite** (또는 `vercel.json` 자동 인식)
4. 첫 배포 완료 후 URL 확인  
   예: `https://edu-team-tms-xxxx.vercel.app`  
   프로젝트 이름을 `edu-team-tms`로 두면 `https://edu-team-tms.vercel.app` 가능(이름 충돌 시 랜덤 접미사)

> **같은 팀에서 Blob만 새로 만들기는 한도 리셋에 안 됩니다.** 반드시 **새 팀/계정**이어야 합니다.

---

## 2. Blob 연결

1. 새 프로젝트 → **Storage** → **Create Database** → **Blob**
2. **Connect to Project** → 방금 만든 TMS 프로젝트 선택
3. **Deployments → Redeploy** (Production)  
   → `BLOB_READ_WRITE_TOKEN` 이 자동 주입됩니다.

### (선택) 예전 스냅샷 복사

기존 팀 Blob이 아직 CLI로 읽히면:

```bash
# 기존 팀에서 (로그인·프로젝트 링크된 상태)
npx vercel blob list ledger/ --limit 5
npx vercel blob download ledger/live-latest.json ./ledger-live.json

# 새 팀 프로젝트로 링크 후
npx vercel link
npx vercel blob put ledger/live-latest.json ./ledger-live.json --pathname ledger/live-latest.json
```

일지·KPI도 동일: `journal/live-latest.json`, `kpi-operational/live-latest.json`  
없으면 배포에 포함된 `public/*-snapshot.json` fallback으로 조회는 됩니다.

---

## 3. 환경 변수

**Project → Settings → Environment Variables** (Production + Preview 권장)

| 변수 | 필수 | 설명 |
|------|------|------|
| `BLOB_READ_WRITE_TOKEN` | ✅ (Blob 연결 시 자동) | 스냅샷 read/write |
| `KAKAO_REST_API_KEY` | ✅ | 점심 메뉴 API |
| `LEDGER_PUBLISH_SECRET` | 권장 | 장부 POST 추가 인증 |
| `VITE_LEDGER_PUBLISH_KEY` | 위와 동일 값 | 클라이언트 키 (설정 시) |
| `VITE_TMS_ORIGIN` | 권장 | 새 운영 URL (`https://새도메인.vercel.app`) |
| `TMS_PUBLISH_ALLOWED_ORIGINS` | 선택 | 커스텀 도메인 추가 시 |

변경 후 **Redeploy** 필수.

---

## 4. GitHub Actions (선택)

기존 repo의 `Deploy Production` 워크플로를 새 계정으로 쓰려면:

1. 새 Vercel 팀 → **Settings → Tokens** → 토큰 생성
2. 프로젝트 **Settings → General** 에서 `ORG_ID`, `PROJECT_ID` 복사
3. GitHub repo **Secrets** 갱신:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
4. `.github/workflows/deploy-production.yml` 의 스모크 URL을 새 도메인으로 수정

**당장만 쓸 때**는 Vercel 대시보드에서 수동 배포해도 됩니다.

---

## 5. 동작 확인

```bash
# GET — 200 또는 404(snapshot 없음) 이면 라우트 정상
curl -sS "https://YOUR-NEW-URL.vercel.app/api/ledger-snapshot" | head -c 200

# POST — 편집 화면에서 「지금 조회에 반영」이 가장 확실
```

성공 시 응답에 `ok: true` 또는 GET `X-Ledger-Source: blob-live`.

실패 메시지:

| 응답 | 의미 |
|------|------|
| `store has been suspended` | 아직 **옛 팀 Blob** 토큰이거나 잘못 연결 |
| `forbidden` | `?mode=edit` URL이 아님 / 출처 불일치 |
| `blob-quota-exceeded` | **새 팀에서도** 한도 초과 (용량 또는 연산) |

코드는 **모든 `*.vercel.app`** 출처에서 POST를 허용하도록 되어 있어, 새 계정 URL은 별도 코드 수정 없이 동작합니다.

---

## 6. 팀 안내

1. **북마크 URL**을 새 운영 주소로 교체
2. 옛 URL(`okestro-edu-team-tms.vercel.app`)은 그대로 두거나 Vercel에서 **비활성/삭제** — 혼선 방지
3. Blob ops 절감:
   - 「지금 조회에 반영」 **필요할 때만**
   - 일지 **팀 공유 저장** 남발 금지
   - 한도 다시 차면 [Blob 중단 운영 가이드](./reference-source/TMS-Blob중단-장부일지-운영가이드.md)

---

## 7. 관련 문서

- [ledger-live-sync.md](./ledger-live-sync.md) — 장부 실시간 반영
- [deployment-process.md](./deployment-process.md) — CI/CD
- [TMS-Blob중단-장부일지-운영가이드.md](./reference-source/TMS-Blob중단-장부일지-운영가이드.md)
