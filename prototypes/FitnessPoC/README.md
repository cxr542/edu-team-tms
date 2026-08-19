# FitnessPoC — 최근 러닝 1회

TMS와 **무관한** iOS PoC입니다.  
Apple Health(HealthKit)에서 **가장 최근 러닝 1회**만 읽어 페이스를 크게 보여줍니다.

## 표시 항목

- 평균 페이스 (hero)
- 거리 / 시간 / 평균 심박 / 칼로리

## 요구 사항

- Mac + Xcode 15+
- 실기 iPhone (시뮬레이터에는 러닝 데이터가 거의 없음)
- Health 앱에 **러닝** 기록이 1건 이상 있어야 함

## 열기 · 실행

1. Mac에서 `FitnessPoC.xcodeproj` 를 Xcode로 연다.
2. Signing & Capabilities에서 Team을 본인 Apple ID로 선택한다.
3. HealthKit capability가 켜져 있는지 확인한다.
4. 실기 iPhone을 연결하고 Run(▶) 한다.
5. 앱에서 **Health 권한 허용** → 최근 러닝이 표시된다.

## 폴더 구조

```text
FitnessPoC/
├── README.md
├── FitnessPoC.xcodeproj/
└── FitnessPoC/
    ├── FitnessPoCApp.swift
    ├── ContentView.swift
    ├── Info.plist
    ├── FitnessPoC.entitlements
    ├── HealthKit/
    │   ├── HealthModels.swift
    │   └── HealthKitManager.swift
    └── Views/
        └── LatestRunView.swift
```

## 범위 밖 (의도적으로 없음)

- TMS / Supabase / Blob 연동
- 서버·로그인
- 러닝 목록·주간 통계
- 지도 GPS 루트
