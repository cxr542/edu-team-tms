# EDU-TMS Obsidian / Docs Graph PoC

## Purpose
EDU-TMS의 Markdown 문서를 Obsidian-compatible Vault처럼 정리하고, 문서 간 관계를 JSON graph로 추출해 SoT 충돌, 운영 위험, URL 중복, Blob 관련 위험을 탐지한다.

## Concept
- Obsidian: 사람이 읽고 탐색하는 Markdown 지식 Vault
- Docs graph JSON: 기계가 분석하는 문서 관계 데이터 (`docs/docs-graph.json`)
- Graph DB / TMS 앱 내 그래프 UI: 후속 단계 (G2+)

관련: [[sot-map]] · [[AGENTS]] · [[DESIGN]] · [[j7-journal-realtime-blob-plan]] · [[j8-journal-supabase-auto-upload-plan]]

## Initial Scope (G1 — 완료 목표)
외부 graph DB·앱 내 force-graph는 만들지 않는다.
repo Markdown을 읽어 `docs/docs-graph.json`을 생성하는 추출 + Obsidian으로 Vault 탐색이 가능한 수준까지.

## Vault 열기 (권장)

1. Obsidian → **Open folder as vault** → **이 repo 루트** (`edu-team-tms/`)
2. 그래프 뷰에서 필터로 `docs/`, `AGENTS.md`, `DESIGN.md`, `README.md`에 집중
3. 노트 간 탐색은 `[[위키링크]]` (예: `[[sot-map]]`, `[[j8-journal-supabase-auto-upload-plan]]`)
4. 관계 재추출: `npm run docs:graph` → `docs/docs-graph.json` 갱신

### Vault 루트 선택
| 선택 | 용도 |
|------|------|
| **Repo root (기본)** | AGENTS/DESIGN/README + `docs/` 한 그래프 |
| `docs/`만 | reference-source 중심, 루트 MD는 그래프에서 빠짐 |

### `.obsidian/` 설정
- **기본: gitignore** — 개인 플러그인/테마 충돌 방지
- 팀 공통으로 커밋하지 않음. 그래프 필터는 이 문서 가이드만 공유

## Node Types
- `document`
- `heading`
- `url`
- `keyword`
- `feature` (예약)
- `risk` (예약)
- `rule` (예약)

## Edge Types
- `links_to` — Markdown `[text](…)` URL, **및 `[[wikilink]]` → 문서**
- `mentions` — 고가치 키워드
- `defines` / `warns_about` (예약)
- `documents` — 문서 → heading
- `copy_of` / `generated_from` (예약)

## High-Value Keywords
우선 추적할 키워드:
- Blob, ledger, journal, localStorage, snapshot, static JSON
- Vercel, GitHub Actions, deploy, push, team share
- 업무일지, KPI, 향상 과제, improve-projects
- mode=edit, access=leader, member

## Non-Goals (G1)
- Obsidian Sync 유료 서버 / 플러그인 설치 강제
- Neo4j 서버 구축
- 외부 API 호출
- 운영 데이터 변경, Blob write/delete
- `public/docs` 복제본을 소스로 수정
- TMS `?module=docs` 안 force-graph UI (G2)

## Suggested Workflow
1. Markdown 문서 목록 수집 (`public/docs`, `.vercel/output`, `outputs`, `logs`, `backups-*` 제외)
2. 제목/헤더/링크/`[[wikilink]]`/URL/키워드 추출
3. `npm run docs:graph` → JSON graph 생성
4. SoT 후보와 복제본 문서 구분 (`sourceKind`)
5. Obsidian에서 Vault로 열어 시각 탐색
6. **커밋 규칙:** `docs/docs-graph.json`은 노드·엣지·문서 수 등 **의미 있는 변경만** 커밋. `generatedAt`만 바뀐 재생성은 커밋하지 않음 ([AGENTS.md](../AGENTS.md))

## Commands
```bash
npm run docs:graph
node --check scripts/extract-docs-graph.mjs
node --check scripts/docs-graph-core.mjs
```

## Future Ideas (G2+)
- TMS ReferenceDocsPage 읽기 전용 미니 그래프
- CI graph summary / 위험 키워드 리포트
- `docs/url-map.md` 자동 생성
- Neo4j import용 CSV
- public/docs ↔ reference-source 복제 관계 강화
