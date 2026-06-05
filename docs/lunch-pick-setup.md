# 오늘 뭐 먹지 — 설정

오케스트로 **파크원타워2** 기준 도보권 점심 추천 (`?mode=edit&module=lunch`)

## 기준 위치

- **기본:** 오케스트로 (파크원타워2) — `37.5261, 126.9282`, 반경 1000m
- 화면 상단 **기준 위치 변경**에서 프리셋(파크원타워2, 여의도역) 또는 **직접 지정**(이름·위도·경도·반경 km) 선택
- **직접 지정** 이름 입력 시 카카오 API로 위·경도 자동 채움 (`purpose=geocode`, 역·건물명 검색)
- 반경 UI는 **km** (내부·API는 m로 변환, 기본 1km)
- 브라우저 `localStorage` (`tms-lunch-origin-v1`) — 기기별 개인 설정
- **검색** 탭 카카오 API 중심 좌표도 동일 기준 위치를 사용
- **오늘·단골:** 파크원·여의도역 프리셋 → `yeouido-lunch.json` 시드. **그 외(직접 지정 등)** → 카카오 API로 기준 위치 반경 내 맛집을 불러와 추천

## 맛집 목록 (수동)

- 파일: [`public/data/yeouido-lunch.json`](../public/data/yeouido-lunch.json)
- **`priceLevel`:** `1` = **13,000원 이내**(회사 점심식대), `2` = **13,000원 초과**
- **`menus`:** `[{ "name": "된장찌개", "priceWon": 9000 }]` — **13,000원 이하 메뉴가 하나라도 있으면** 앱이 「이내」 뱃지 + **가장 저렴한 식대 이내 메뉴**를 대표 메뉴로 표시
- `menus` 없으면 `menuHints`·`priceLevel`로 **가격 추정**(시드) — 실제 가격과 다를 수 있음
- **카카오 검색** 맛집은 API에 가격 없음 → **등록** 탭에서 「대표 메뉴·가격」 입력 권장
- 배포 시 `public/` 에 포함되므로 JSON 수정 후 `npm run build:team` 또는 `npm run dev` 재시작

## 카카오 로컬 API (검색 탭)

1. [Kakao Developers](https://developers.kakao.com/) 앱 생성
2. **REST API 키** 발급
3. Vercel 프로젝트 환경변수: `KAKAO_REST_API_KEY`
4. 로컬: 프로젝트 루트 `.env.local` 에 동일 키 (Vite dev 플러그인이 `api/kakao-local.js` 호출)

키가 없으면 **오늘·단골** 탭은 동작합니다. **검색·등록(지도 URL)** 은 API 없을 때 카카오맵 **검색 링크**만 자동 입력됩니다.

```bash
cp .env.local.example .env.local
# .env.local 에 KAKAO_REST_API_KEY=발급받은키 입력 후
npm run dev   # 반드시 재시작
```

## 로컬 실행

```bash
cd "apps/TMS(Team Management System)"
npm run dev
# 기본 http://localhost:3000/?mode=edit&module=lunch
# 3000 포트가 이미 쓰이면 Vite가 3001, 3002… 로 자동 변경 — 터미널에 뜨는 Local URL을 사용
```

운영 API와 동일하게 테스트하려면 `npx vercel dev` 사용.

## 방문 기록

- 브라우저 `localStorage` (`tms-lunch-history-v1`)
- 기기·브라우저별 개인 기록 (팀 공유 아님)

## 신규 식당 등록

- **등록** 탭 또는 **검색** 결과의 「단골에 추가」
- `localStorage` (`tms-lunch-custom-spots-v1`) — 등록·삭제는 이 브라우저에만 반영
- 팀 전체 반영: 등록 데이터를 백업한 뒤 `yeouido-lunch.json`의 `spots` 배열에 수동 병합 후 배포
