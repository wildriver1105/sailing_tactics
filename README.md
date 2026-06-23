# ⛵ Sailing Tactics — 세일링 전술 보드

칠판 위에 세일보트·부표를 올려놓고, **클릭 한 번마다 애플 키노트의 매직 무브(Magic Move)처럼** 오브젝트가 다음 프레임 위치로 부드럽게 이동하며 경기 흐름을 보여주는 프로그램입니다. 각 장면마다 전략·전술 설명이 함께 표시됩니다.

## 실행

```bash
npm install
npm run dev
# http://localhost:3000 (이 저장소 환경에서는 3007)
```

## 네이티브 앱 (Mac · iPad) — Tauri 2

웹 UI를 그대로 재사용해 Tauri 2 셸로 감싼 네이티브 앱. 데이터는 브라우저가 아닌
**파일 시스템에 JSON으로 CRUD**(시나리오별 개별 파일).

```bash
# macOS 데스크톱 앱
npm run tauri:dev      # 개발 (창 실행 + 자동 저장 → ~/SailingTactics/scenarios/)
npm run tauri:build    # 배포용 .app / .dmg

# iPad / iOS (Xcode + CocoaPods 필요)
npm run tauri:ios:dev "iPad Pro 13-inch (M5)"   # 시뮬레이터
npm run tauri:ios:build                          # .ipa (실기기는 Apple Developer 서명 필요)
```

- 저장소 코어: [`lib/storage.ts`](lib/storage.ts) — `isTauri()` 런타임 감지로 네이티브(파일)/브라우저(localStorage) 분기. `@tauri-apps/*` 는 동적 import 라 웹 번들에 포함되지 않음.
- 권한: [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json) (fs/dialog/os 스코프).
- macOS 앱은 **비샌드박스**라 홈 디렉토리에 직접 파일 생성. iPad는 OS 정책상 앱 데이터 디렉토리만 사용.

> **iOS 빌드 시 CocoaPods 주의:** 이 머신의 Homebrew cocoapods 가 깨져 있어,
> 사용자 gem 으로 설치한 pod 을 PATH 앞에 두고 빌드한다:
> ```bash
> gem install cocoapods --install-dir "$HOME/.gem-cocoapods"
> export GEM_HOME="$HOME/.gem-cocoapods" GEM_PATH="$HOME/.gem-cocoapods"
> export PATH="$HOME/.gem-cocoapods/bin:$PATH"
> ```
> 시뮬레이터 부팅에는 iOS 26.5 런타임이 필요(현재 26.2만 설치됨). 없으면 열린 Xcode 에서 빌드/실행.

## 핵심 개념

- **프레임(Frame)**: 한 장면. 보트/부표의 위치·회전·표시 여부의 스냅샷.
- **매직 트랜지션**: 같은 오브젝트(같은 id)는 프레임이 바뀔 때 이전 위치 → 새 위치로 자연스럽게 보간되어 움직입니다. (Framer Motion `animate`)
- **상속**: 프레임에 명시하지 않은 오브젝트는 직전 프레임 위치를 그대로 유지합니다. 그래서 "변한 것만" 적어주면 됩니다.

## 사용법

### 발표(프레젠트) 모드
- **보드 클릭** 또는 **다음/이전** 버튼, 키보드 **→ / ← / Space** 로 장면 이동
- 하단 **필름스트립(1·2·3…)** 으로 특정 장면 바로 이동
- 우측 패널에 현재 장면의 전술 설명 표시

### 편집 모드 (우상단 ✏️ 편집)
- 오브젝트를 **드래그**해서 위치 이동
- 오브젝트 클릭 → 선택 후 **회전 / 보이기·숨기기 / 라벨 수정 / 삭제**
- **＋ 프레임 추가**: 현재 장면을 복제(상속)한 새 장면 생성 → 보트만 옮기면 그 차이가 트랜지션으로 재생
- **오브젝트 추가**: 보트 / 마크 / 본부선 / 핀 / 바람 / 메모
- 프레임 제목·전술 설명 인라인 편집
- 모든 편집 내용 자동 저장 · **↺ 초기화** 로 기본값 복원
  - **네이티브 앱(Mac/iPad)**: 시나리오 1개 = JSON 파일 1개로 저장
    (macOS `~/SailingTactics/scenarios/<id>.json`, iPad는 앱 데이터 디렉토리)
  - **브라우저(`npm run dev`)**: localStorage 폴백
  - 편집 모드에서 **⤓ 내보내기 / ⤒ 가져오기** 로 시나리오 JSON 파일 주고받기 (네이티브 전용)

## 기본 제공 시나리오

1. **스타트 라인 전략** — 라인 바이어스 파악 → 포지셔닝 → 가속 → 클리어 에어
2. **풍상 마크 라운딩 & 레이라인** — 오버스탠딩 회피 → 마크룸 → 와이드 인/타이트 아웃
3. **포트-스타보드 크로스 & 리바우** — 우선권 판단 → 회피 → 리-바우 압박

## 구조

```
app/            Next.js App Router (layout, page, globals.css)
components/
  TacticsBoard.tsx   메인 보드 + 발표/편집 패널 (클라이언트 컴포넌트)
  EntityIcon.tsx     보트·부표·본부선·핀·바람·메모 SVG
lib/
  types.ts           데이터 모델 + 프레임 상태 누적 병합(resolveStates)
  scenarios.ts       기본 시나리오 데이터
  storage.ts         저장 추상화 (네이티브 파일 CRUD ↔ 브라우저 localStorage)
src-tauri/           Tauri 2 네이티브 셸 (macOS · iPad)
  tauri.conf.json    창/번들/식별자 설정
  capabilities/      fs·dialog·os 권한 + 파일 경로 스코프
  src/lib.rs         플러그인 등록 (Rust 보일러플레이트)
```

좌표계: `x`(0=좌, 100=우), `y`(0=위/풍상, 100=아래/풍하). 회전 `rotation`은 0=뱃머리 위쪽, 시계방향 +.
