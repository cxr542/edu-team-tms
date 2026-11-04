# PPT Academizer × EDU-TMS

## SoT
- TMS UI: `module=academizer` → [`src/pages/AcademizerPage.jsx`](../src/pages/AcademizerPage.jsx)
- Conversion API: sibling repo [`cxr542/ppt-academizer`](https://github.com/cxr542/ppt-academizer) (FastAPI Docker)
- Deploy API (현행): [`ppt-academizer/deploy/self-host/README.md`](https://github.com/cxr542/ppt-academizer/blob/main/deploy/self-host/README.md) (사내 Windows PC · WSL2 Docker · Tailscale Funnel)
- Deploy API (롤백용): [`ppt-academizer/docs/DEPLOY-TMS-RENDER.md`](../../ppt-academizer/docs/DEPLOY-TMS-RENDER.md) (Render)
- Netlify UI/proxy: **deprecated** for TMS

## Status (2026-11-04)

| 항목 | 상태 |
|------|------|
| 로컬 API + fixture #1 스모크 | ✅ `01_k8s_dashboard_lab_lecture` preview·academize (13장) |
| `ppt-academizer` main | ✅ Render template fetch [PR #4](https://github.com/cxr542/ppt-academizer/pull/4) |
| TMS React 네이티브 UI | ✅ [PR #114](https://github.com/cxr542/edu-team-tms/pull/114) 머지 |
| HTML 입력 (`.html`/`.htm`) | ✅ 엔진 v1.8.0 · 메뉴 화면 허용 [PR #227](https://github.com/cxr542/edu-team-tms/pull/227) |
| 변환 UI 개편 (스테퍼·변환 스테이지) | ✅ [PR #228](https://github.com/cxr542/edu-team-tms/pull/228) |
| 운영 엔진 | ✅ 사내 Windows PC (Tailscale Funnel, `https://<pc이름>.<tailnet>.ts.net`) · 엔진 v1.8.1 · `/health` 200 (2026-11-04) |
| Vercel `PPT_ACADEMIZER_API_URL` | ✅ 사내 서버 Funnel 주소 (실제 값은 Vercel 환경변수 기준, 이 문서에 적지 않음) · Actions `Set Academizer API URL` + `Deploy Production`으로 전환 (2026-11-04) |
| Render API | 롤백용으로 유지 · `https://ppt-academizer-api.onrender.com` |
| 전환 후 시험 | ✅ 엔진 직접 호출: HTML 가이드 → 19장 (4초), PPTX → 7장 (3초) · TMS 화면에서 변환 시험 완료 |

## Next

1. 서버 재부팅 복구 — Windows 자동 로그인, Tailscale "Run unattended" 설정 후 실제 재부팅 확인 (현재는 로그인 유지 상태로 운영, WSL 유지 작업 `docker-host-keepalive`)
2. 접근 제어 — Funnel 주소는 인증 없이 공개. Gemini 키 사용량·예산 한도 설정, 필요 시 인증 방식 설계
3. 큰 덱(예: CONTRABASS 34MB) 변환 시간·메모리 확인
4. tailnet 정리 — 개인 계정 소유 tailnet에 서버가 포함되어 있음. 소유 계정·미사용 기기 정리
5. 안정 운영 확인 후 Render 정리
6. (선택) real_world fixture 2~5 — [`ppt-academizer/docs/evaluation/real_world_fixture_evaluation.md`](../../ppt-academizer/docs/evaluation/real_world_fixture_evaluation.md)

상세 절차: 엔진 저장소 [`deploy/self-host/README.md`](https://github.com/cxr542/ppt-academizer/blob/main/deploy/self-host/README.md) (현행), sibling [`DEPLOY-TMS-RENDER.md`](../../ppt-academizer/docs/DEPLOY-TMS-RENDER.md) (롤백용)

## 롤백 (사내 서버 → Render)
1. GitHub Actions `Set Academizer API URL` 실행: `api_url=https://ppt-academizer-api.onrender.com`
2. GitHub Actions `Deploy Production` 실행 (환경변수는 재배포해야 서버리스에 반영)
3. 두 워크플로 모두 수동 실행(`workflow_dispatch`)이며, 실행 전 사용자 승인 필요 (AGENTS.md)

## Runtime
1. Browser opens TMS `/admin?module=academizer`
2. `GET /api/academizer?action=health` (Vercel) → upstream `/health`
3. Upload preview/academize: browser **POST directly** to `PPT_ACADEMIZER_API_URL` (CORS; avoids Vercel body limits)

## Env (Vercel / `.env.local`)
```bash
# 운영: 사내 서버 Funnel 주소 (값은 Vercel 환경변수 참고, 끝에 / 없이)
PPT_ACADEMIZER_API_URL=https://<pc이름>.<tailnet>.ts.net
# 롤백용(Render): https://ppt-academizer-api.onrender.com
# local (verified 2026-07-23):
# PPT_ACADEMIZER_API_URL=http://127.0.0.1:8766
# VITE_PPT_ACADEMIZER_API_URL=http://127.0.0.1:8766
```

## Local smoke (이미 통과한 경로)
```bash
# API
cd ppt-academizer
export TEMPLATE_PPTX="$(mdfind 'kMDItemFSName == \"1.아카데미 강의안 템플릿.pptx\"' | head -1)"
PPT_ACADEMIZER_SKIP_PP_REPAIR=1 PORT=8766 ./scripts/run_server.sh

# fixture #1 (gitignored) — 원본 예: ~/Documents/k8s_dashboard_lab_lecture.pptx
# → tests/fixtures/real_world/01_k8s_dashboard_lab_lecture.pptx

# TMS
# .env.local: PPT_ACADEMIZER_API_URL=http://127.0.0.1:8766
npm run dev   # /admin?module=academizer
```

결과 샘플(로컬): `ppt-academizer/outputs/smoke/01_k8s_academized.pptx`

## Access
Admin shell only (관리·공통) for now — same as previous embed.
