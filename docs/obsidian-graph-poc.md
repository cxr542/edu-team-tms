# EDU-TMS Obsidian / Docs Graph PoC

## Purpose
EDU-TMS의 Markdown 문서를 Obsidian-compatible Vault처럼 정리하고, 문서 간 관계를 JSON graph로 추출해 SoT 충돌, 운영 위험, URL 중복, Blob 관련 위험을 탐지한다.

## Concept
- Obsidian: 사람이 읽고 탐색하는 Markdown 지식 Vault
- Docs graph JSON: 기계가 분석하는 문서 관계 데이터
- Graph DB: 필요 시 Neo4j 등으로 확장 가능한 후속 단계

## Initial Scope
이번 PoC는 외부 graph DB를 만들지 않는다.
repo 안의 Markdown을 읽어서 `docs/docs-graph.json` 형태의 산출물을 생성하는 read-only 추출 스크립트까지만 다룬다.

## Node Types
예상 노드 타입:
- `document`
- `heading`
- `url`
- `keyword`
- `feature`
- `risk`
- `rule`

## Edge Types
예상 관계 타입:
- `links_to`
- `mentions`
- `defines`
- `warns_about`
- `documents`
- `copy_of`
- `generated_from`

## High-Value Keywords
우선 추적할 키워드:
- Blob
- ledger
- journal
- localStorage
- snapshot
- static JSON
- Vercel
- GitHub Actions
- deploy
- push
- team share
- 업무일지
- KPI
- 향상 과제
- improve-projects
- mode=edit
- access=leader
- member

## Non-Goals
- Obsidian 플러그인 설치
- Neo4j 서버 구축
- 외부 API 호출
- 운영 데이터 변경
- Blob write/delete
- public/docs 복제본 수정

## Suggested Workflow
1. Markdown 문서 목록 수집
2. 제목/헤더/링크/URL/키워드 추출
3. JSON graph 생성
4. SoT 후보와 복제본 문서 구분
5. 위험 키워드가 있는데 AGENTS.md나 SoT map에 반영되지 않은 항목 탐지
6. 필요 시 Obsidian에서 Vault로 열어 시각 탐색

## Future Ideas
- `docs/url-map.md` 자동 생성
- Blob 관련 문서 관계만 따로 보기
- leader/member URL 정의 중복 탐지
- public/docs와 docs/reference-source 간 복제 관계 확인
- graph DB 또는 Neo4j import용 CSV 생성
