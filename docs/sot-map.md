# EDU-TMS Source of Truth Map

## Purpose
이 문서는 EDU-TMS repo에서 어떤 Markdown 문서를 무엇의 기준으로 봐야 하는지 정리한다.

## Golden Rules
- `docs/reference-source/*`는 주요 원본 참고문서다.
- `public/docs/*`는 배포용 복제본으로 보고 직접 수정하지 않는다.
- `.vercel/output/static/*`는 빌드 산출물로 보고 직접 수정하지 않는다.
- 운영 데이터, Blob, ledger, journal 관련 변경은 별도 승인 없이 수행하지 않는다.
- URL/권한/운영 절차는 반드시 기준 문서를 확인한 뒤 수정한다.
- AI/Codex 작업자는 읽기 전용 조사와 수정 작업을 구분한다.
- push/deploy/Blob write는 명시 승인 없이 수행하지 않는다.

## Primary SoT Documents
| Area | Source of Truth | Notes |
| --- | --- | --- |
| Product overview | `README.md` | 첫 진입점. 상세 운영 규칙은 별도 문서 참조 |
| Design | `DESIGN.md` | 현재 제품 설계 기준. 오래된 내용 발견 시 갱신 필요 |
| URL and access rules | `docs/reference-source/TMS-접속URL-북마크.md` | 팀장/구성원/문서/일지 진입점 기준 |
| Release history | `docs/reference-source/TMS-릴리즈노트.md` | 변경 이력 기준. main 머지 시 PR 기반 자동 prepend 후 `sync:docs`. 현재 운영 규칙과 구분 필요 |
| Ledger/live sync | `docs/ledger-live-sync.md` | ledger, localStorage, Blob 관련 운영 기준 |
| Deployment | `docs/deployment-process.md` | GitHub/Vercel 배포 및 smoke check 기준 |
| KPI-journal linkage | `docs/reference-source/KPI-일지-TMS-연계-가이드.md` | 업무일지와 KPI 연결 설명 |
| Team KPI menu | `docs/reference-source/KPI-TMS-팀KPI메뉴.md` | KPI 메뉴/URL 안내 |
| KPI operating model | `docs/reference-source/KPI-TMS-운영모델-v2.md` | KPI 운영 모델 참고 |
| Traceability | `docs/reference-source/KPI-TMS-traceability-tms.md` | TMS/Excel 필드 추적 참고 |
| Workspace guide | `docs/workspace-guide.md` | workspace/repo 구조 안내 |
| Journal J7 Realtime·Blob | `docs/j7-journal-realtime-blob-plan.md` | 일지 팀 공유 SoT를 Supabase로 이전·Realtime 알림 단계 (J7-0…J7e) |
| Journal J8 Supabase auto-upload | `docs/j8-journal-supabase-auto-upload-plan.md` | Blob 수동 유지 · Supabase debounce 자동 업로드 (자동 pull 비범위) |
| Journal Supabase sync | `docs/journal-supabase-sync-plan.md` | 일지 Supabase 전환 원칙·단계 |
| Operations backlog | `docs/operations-backlog.md` | 운영 후속 작업·일지 J-track 진행률 |

## Non-SoT Copies and Build Outputs
다음 파일들은 원본 문서가 아니라 복제본 또는 산출물로 취급한다.
- `public/docs/*`
- `.vercel/output/static/docs/*`
- `public/tools/cloud-chatbot/README.md`
- `.vercel/output/static/tools/cloud-chatbot/README.md`

## Missing but Recommended Documents
현재 별도 파일로는 없음:
- `PLAN.md`
- `PRD.md`
- `ROADMAP.md`
- `RUNBOOK.md`
- `OPS.md`
- `DEPLOYMENT.md`
필요 시 새 문서를 만들기보다 먼저 기존 문서와 중복 여부를 확인한다.

## Operational Safety References
운영 안전 확인 시 우선 참조:
1. `docs/ledger-live-sync.md`
2. `docs/deployment-process.md`
3. `docs/reference-source/TMS-접속URL-북마크.md`
4. `docs/reference-source/TMS-릴리즈노트.md`

## AI/Codex Work Rules
AI 작업자는 다음 원칙을 따른다.
- 읽기 전용 조사와 수정 작업을 구분한다.
- 운영 데이터 쓰기, Blob 쓰기/삭제/POST, deploy, push는 명시 승인 없이는 수행하지 않는다.
- `public/docs/*` 또는 `.vercel/output/static/*` 문서를 원본처럼 수정하지 않는다.
- URL, access, role, ledger, journal, Blob 관련 변경은 반드시 관련 SoT 문서를 먼저 확인한다.

## Obsidian and Graph Notes
EDU-TMS 문서는 Obsidian Vault처럼 읽을 수 있다.
다만 Obsidian은 사람이 읽는 지식 지도이고, graph DB/JSON graph는 기계가 분석하는 관계 지도다.
우선 목표는 외부 graph DB가 아니라 repo 내부 Markdown에서 관계를 추출한 `docs-graph.json` PoC를 만드는 것이다.

## Next Cleanup Candidates
- `AGENTS.md` 보강 또는 신설
- `DESIGN.md` 현재 제품 기준으로 정리
- `README.md`에 SoT map 안내 추가
- 운영 안전 요약 문서 분리 여부 검토
- `docs/url-map.md` 분리 여부 검토
- `docs/ops-safety.md` 분리 여부 검토
