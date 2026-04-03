# PRD: Color Guessing Multiplayer Game

> 작성일: 2026-04-03
> 버전: 1.0.0
> 작성자: AI Assistant (Claude Code)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [목표 및 성공 지표](#2-목표-및-성공-지표)
3. [기술 스택 및 아키텍처](#3-기술-스택-및-아키텍처)
4. [기능 요구사항](#4-기능-요구사항-상세)
5. [비기능 요구사항](#5-비기능-요구사항)
6. [게임 상태 머신](#6-게임-상태-머신-state-machine)
7. [데이터 구조 설계](#7-데이터-구조-설계)
8. [화면 설계](#8-화면-설계-페이지-목록-및-컴포넌트-구조)
9. [개발 우선순위 및 마일스톤](#9-개발-우선순위-및-마일스톤)
10. [기술적 제약사항 및 리스크](#10-기술적-제약사항-및-리스크)

---

## 1. 프로젝트 개요

### 1.1 서비스 명

**Color Match** — RGB 컬러 근사값 맞추기 멀티플레이어 게임

### 1.2 서비스 설명

랜덤하게 생성된 RGB 컬러를 3초간 화면에 노출하고, 플레이어들이 10초 이내에 RGB 컬러 피커를 통해 해당 컬러와 가장 유사한 컬러를 선택하는 게임이다. 선택한 컬러와 타겟 컬러 간의 RGB 공간 내 유클리디안 거리를 기반으로 순위를 매기고, 1~3위 플레이어에게 점수를 부여한다.

### 1.3 배경 및 필요성

- 별도의 서버 구축 없이 동작하는, 프론트엔드만으로 구현 가능한 실시간 멀티플레이어 게임에 대한 수요
- 색감 훈련, 팀 아이스브레이킹, 간단한 파티 게임 용도로 활용 가능
- 초대 링크 기반 접속으로 별도 회원가입 없이 즉시 참여 가능한 경량 게임

### 1.4 대상 사용자

- 팀 빌딩 / 아이스브레이킹이 필요한 소규모 그룹 (2~8인)
- 간단한 멀티플레이 브라우저 게임을 즐기려는 캐주얼 게이머
- 색감 능력을 테스트하고 싶은 디자이너 / 개발자

---

## 2. 목표 및 성공 지표

### 2.1 제품 목표

| 목표 | 설명 |
|------|------|
| 서버리스 멀티플레이 구현 | 백엔드 없이 PeerJS(WebRTC) 기반으로 2~8인 실시간 플레이 지원 |
| 즉시 참여 가능한 UX | 회원가입 없이 닉네임 + 프로필 컬러만으로 즉시 게임 참여 |
| 공정한 스코어링 | RGB 유클리디안 거리 기반의 객관적 순위 산정 |
| 싱글 플레이 지원 | 혼자서도 색감 트레이닝 목적으로 플레이 가능 |

### 2.2 성공 지표 (KPI)

| 지표 | 목표값 | 측정 방법 |
|------|--------|-----------|
| 게임 완주율 | 세션 시작 대비 8라운드 완료 70% 이상 | 로컬 스토리지 기반 세션 추적 |
| 멀티플레이 연결 성공률 | PeerJS 연결 시도 대비 성공 90% 이상 | 에러 핸들링 로그 |
| 라운드 응답률 | 전체 라운드에서 플레이어의 90% 이상이 10초 내 컬러 선택 | 게임 상태 기록 |
| 재플레이율 | 게임 종료 후 [다시하기] 선택 비율 40% 이상 | 버튼 클릭 이벤트 |

---

## 3. 기술 스택 및 아키텍처

### 3.1 기술 스택

| 분류 | 기술 | 버전 | 용도 |
|------|------|------|------|
| UI 프레임워크 | React | ^19.x | 컴포넌트 기반 UI |
| 언어 | TypeScript | ^5.x | 타입 안전성 |
| 스타일링 | Tailwind CSS | ^3.x | 유틸리티 기반 스타일 |
| 라우팅 | React Router DOM | ^6.x | SPA 페이지 라우팅 |
| P2P 통신 | PeerJS | ^1.x | WebRTC 기반 실시간 멀티플레이 |
| 고유 ID 생성 | nanoid | ^5.x | 룸 ID 생성 |
| 빌드 도구 | Vite | ^5.x | 빠른 개발 서버 및 번들링 |

### 3.2 멀티플레이 아키텍처 (서버리스)

```
[호스트 플레이어]                    [게스트 플레이어들]
     |                                      |
     | new Peer(roomId)                     | new Peer(guestId)
     |                                      |
  PeerJS Cloud Server (무료 브로커)  ←→   PeerJS Cloud Server
     |                                      |
     |←——————— DataConnection ——————————→|
     |                                      |
  호스트: 게임 상태 Source of Truth       게스트: 상태 수신 + 입력 전송
  - 타이머 제어                            - 컬러 선택값 호스트에 전송
  - 페이즈 전환 브로드캐스트              - 호스트로부터 상태 수신
  - 점수 계산 및 배포                      - UI 렌더링
```

**통신 흐름:**

1. 호스트가 `roomId`를 Peer ID로 PeerJS에 등록
2. 게스트는 초대 링크의 `roomId`로 호스트에 연결
3. 호스트가 모든 게스트와 1:1 DataConnection 유지
4. 호스트가 게임 상태를 직렬화하여 모든 연결된 피어에 브로드캐스트
5. 게스트는 컬러 선택 이벤트를 호스트에만 전송, 호스트가 집계 후 재배포

**싱글 플레이 모드:**
- PeerJS 연결 없이 로컬 React 상태만으로 동작
- 게임 생성 시 참가자가 1명이면 자동으로 싱글 모드 진입

### 3.3 디렉토리 구조

```
src/
├── components/
│   ├── ColorBox.tsx           # 800×800 타겟 컬러 표시 박스
│   ├── ColorPicker.tsx        # RGB 슬라이더 컬러 피커 (position: fixed)
│   ├── PlayerProfile.tsx      # 원형 아바타 + 닉네임
│   ├── PlayerGrid.tsx         # 하단 참가자 가로 그리드
│   ├── ComparisonGrid.tsx     # 라운드 결과 비교 그리드
│   ├── Scoreboard.tsx         # 점수판
│   ├── Timer.tsx              # 카운트다운 + 시간 종료 메세지
│   └── RoundHighlight.tsx     # 1~3위 하이라이트 표시
├── pages/
│   ├── HomePage.tsx           # 루트 페이지 (게임 만들기/참여하기)
│   ├── LobbyPage.tsx          # 대기실 (플레이어 목록, 게임 시작)
│   ├── GamePage.tsx           # 메인 게임 화면
│   └── ResultPage.tsx         # 최종 결과 및 랭킹
├── context/
│   └── GameContext.tsx        # 전역 게임 상태 (useReducer)
├── hooks/
│   ├── useGame.ts             # 게임 로직 훅
│   ├── usePeer.ts             # PeerJS 추상화 훅
│   └── useTimer.ts            # 타이머 훅
├── utils/
│   ├── colorUtils.ts          # 컬러 거리 계산, 랜덤 컬러 생성
│   └── roomUtils.ts           # 룸 ID 생성, 초대 링크 생성
└── types/
    └── game.types.ts          # 전체 타입 정의
```

---

## 4. 기능 요구사항 (상세)

### 4.1 루트 페이지 (/)

#### FR-001: 게임 만들기

| 항목 | 내용 |
|------|------|
| 진입점 | 루트 페이지 [게임 만들기] 버튼 클릭 |
| 입력 폼 | 닉네임 (텍스트, 필수, 중복 허용) |
| | 프로필 컬러 (컬러 피커, 필수) |
| 처리 | `nanoid()` 또는 `crypto.randomUUID()`로 고유 `roomId` 생성 |
| | 호스트 플레이어 정보를 GameContext에 저장 |
| | PeerJS로 `roomId`를 Peer ID로 등록 |
| 이동 | `/game/:roomId` (로비 페이지)로 이동 |
| 초대 링크 | `https://{domain}/game/:roomId` 형태로 클립보드 복사 기능 제공 |

#### FR-002: 게임 참여하기

| 항목 | 내용 |
|------|------|
| 진입점 | 루트 페이지 [게임 참여하기] 버튼 클릭, 또는 초대 링크 직접 접속 |
| 입력 폼 | 닉네임 (텍스트, 필수, 중복 허용) |
| | 프로필 컬러 (컬러 피커, 필수) |
| | 초대 링크 입력란 (URL, 필수) — 초대 링크 직접 접속 시 자동 입력 |
| 처리 | 입력된 초대 링크에서 `roomId` 추출 |
| | PeerJS로 호스트(`roomId`)에 연결 시도 |
| | 연결 성공 시 닉네임 + 프로필 컬러를 호스트에 전송 |
| 이동 | 호스트로부터 승인 수신 시 `/game/:roomId`로 이동 |
| 거부 조건 | 게임이 이미 시작된 경우 (호스트가 `gameStarted: true` 플래그 보유 시) |
| | 플레이어 수가 이미 8명인 경우 |

#### FR-003: 닉네임 및 프로필 컬러 유효성 검사

- 닉네임: 공백 불가, 최대 10자, 필수
- 프로필 컬러: 기본값 제공 (예: `#3B82F6`), 필수

---

### 4.2 로비 / 대기실 (/game/:roomId)

#### FR-004: 플레이어 목록 표시

- 연결된 모든 플레이어를 원형 아바타(프로필 컬러) + 닉네임 형태로 표시
- 호스트 플레이어에 "방장" 배지 표시
- 최대 8명까지 표시, 8명 초과 시 신규 연결 거부

#### FR-005: 초대 링크 공유

- 현재 URL(`/game/:roomId`)을 초대 링크로 표시
- [링크 복사] 버튼 클릭 시 클립보드에 복사
- 복사 완료 피드백 메세지 (1초간 "복사됨!" 표시)

#### FR-006: 게임 시작

- 호스트만 [게임 시작] 버튼 노출
- 최소 1명(싱글 플레이) 이상이면 시작 가능
- 클릭 시 `gameStarted: true` 플래그를 모든 피어에 브로드캐스트
- 모든 클라이언트가 게임 페이지 상태로 전환
- 게임 시작 이후 신규 참가자 거부

---

### 4.3 게임 페이지 (/game/:roomId) — 인게임

#### FR-007: Phase 1 — 컬러 공개 (3초)

- 화면 중앙에 `800px × 800px` 사각형 박스 렌더링
- 랜덤 RGB 컬러를 배경색으로 설정 (`Math.random() * 255` × 3)
- 박스 하단에 RGB 코드 미표시 (플레이어가 직접 기억해야 함)
- 화면 하단 플레이어 그리드: 가로 정렬, `items-center`, `gap-[20px]`
  - 각 플레이어: 원형 아바타(프로필 컬러 배경) + 하단 닉네임
- 3초 카운트다운 타이머 표시
- 타이머 종료 시 Phase 2로 전환

#### FR-008: Phase 2 — 컬러 선택 (10초)

- 타겟 컬러 박스 숨김 처리 (배경을 중립색으로 교체)
- RGB 컬러 피커 오버레이 표시 (`position: fixed`, 화면 중앙)
  - R, G, B 각각 0~255 범위 슬라이더 제공
  - 현재 선택 컬러 미리보기 + HEX/RGB 코드 실시간 표시
- 피커 뒤 배경에 현재 선택 컬러가 대형 색상 블록으로 표시
- 상단 10초 카운트다운 타이머
- 타이머 종료 시
  - 컬러 피커 비활성화
  - 타이머 영역에 **"시간 종료!"** 메세지 표시
  - 선택하지 않은 플레이어는 마지막으로 선택된 컬러 또는 기본값(`rgb(128,128,128)`)으로 처리
- 2초 유지 후 Phase 3으로 전환

#### FR-009: Phase 3 — 결과 비교 (5초)

- 화면 전체를 그리드로 재편:
  - `grid-cols-{참가자수}`, `grid-rows-2`
  - **Row 1**: 모든 열에 동일한 타겟 컬러 표시 (원래 랜덤 컬러)
  - **Row 2**: 각 열에 해당 플레이어가 선택한 컬러 표시
- 각 컬러 박스 하단에 RGB 코드 및 HEX 코드 표시
- Row 2의 각 박스 상단에 해당 플레이어 닉네임 표시
- **"분석 중..."** 텍스트를 화면 중앙에 오버레이로 5초간 표시

#### FR-010: Phase 4 — 점수 산정 및 하이라이트

- 유클리디안 거리 계산으로 플레이어 순위 결정:
  ```
  distance = sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)
  ```
- 점수 부여:
  - 1위 (가장 근사): **3점**
  - 2위: **2점**
  - 3위: **1점**
  - 4위 이하: 0점
- 동점 처리: 거리가 동일한 경우 동순위 처리, 동순위 다음 순위 건너뜀
- 하이라이트 표시 (각 플레이어 컬러 박스에 적용):
  - 1위: 골드 글로우 + 왕관 배지 + 애니메이션
  - 2위: 실버 글로우 + 배지
  - 3위: 브론즈 글로우 + 배지
- 하이라이트 상태로 다음 라운드 전환까지 유지 (약 3초)

#### FR-011: 라운드 전환

- 8라운드 반복
- 각 라운드 시작 전: 이전 라운드 하이라이트 제거
- 현재 라운드 번호 및 누적 점수 화면 상단에 항상 표시
- 6라운드 이상부터 "마지막 {N}라운드" 텍스트 강조 표시

---

### 4.4 결과 페이지 (게임 종료 후)

#### FR-012: 최종 랭킹 표시

- 8라운드 종료 후 최종 점수 기반 랭킹 표시
- 랭킹 카드: 순위 번호, 플레이어 프로필(원형 아바타), 닉네임, 총 점수
- 1위 플레이어 강조 표시 (크기, 색상, 애니메이션)

#### FR-013: 재시작 / 나가기

- [다시하기] 버튼: 현재 세션 플레이어들과 새 게임 시작
- [나가기] 버튼: 루트 페이지(`/`)로 이동, 연결 해제

**재시작 로직:**

1. [다시하기] 클릭 시 호스트에 `wantReplay: true` 전송
2. 호스트가 모든 플레이어의 응답을 수집 (페이지 이탈 = `wantReplay: false`)
3. 모든 플레이어가 선택하거나 60초 타임아웃 경과 시
4. `wantReplay: true`인 플레이어들만 모아 새 게임 룸 생성
5. 새 roomId로 리다이렉트

---

### 4.5 싱글 플레이 모드

- 게임 생성 후 대기실에서 바로 [게임 시작] 가능 (1인)
- PeerJS 연결 없이 로컬 상태만으로 동작
- 점수 산정 시 플레이어 1명이므로 항상 1위
- 라운드별 자신의 컬러 근사도 퍼센트(%) 추가 표시
  - `(1 - distance / maxDistance) * 100` 형태로 계산
  - `maxDistance = sqrt(255² + 255² + 255²) ≈ 441.67`

---

## 5. 비기능 요구사항

### 5.1 성능

| 항목 | 요구사항 |
|------|----------|
| 초기 로드 | 3G 환경에서 3초 이내 First Contentful Paint |
| 피커 반응성 | 슬라이더 조작 시 16ms 이내 컬러 미리보기 갱신 (60fps) |
| P2P 레이턴시 | 동일 지역 기준 PeerJS 메세지 100ms 이내 도달 |
| 번들 크기 | PeerJS 포함 초기 번들 500KB 이하 (gzip) |

### 5.2 호환성

| 항목 | 요구사항 |
|------|----------|
| 브라우저 | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| 화면 | 1280px 이상 데스크탑 최적화 (게임 보드 기준) |
| WebRTC | WebRTC 미지원 환경에서 싱글 플레이 모드로 자동 전환 |

### 5.3 접근성

- 컬러 박스에 RGB 코드 텍스트 병기 (색맹 사용자 배려)
- 키보드로 RGB 슬라이더 조작 가능 (방향키 ± 1 조정)
- 폼 입력란 `aria-label` 및 `aria-required` 속성 부여

### 5.4 보안

- PeerJS 메세지 수신 시 데이터 유효성 검증 (타입 가드)
- `roomId`에 추측 가능한 패턴 사용 금지 (`nanoid(10)` 권장)
- XSS 방지: 닉네임 입력값 렌더링 시 React의 기본 이스케이프 사용

---

## 6. 게임 상태 머신 (State Machine)

### 6.1 전체 상태 다이어그램

```
[IDLE]
  |
  | 게임 만들기 / 참여하기
  v
[LOBBY]
  |
  | 호스트가 [게임 시작] 클릭
  v
[ROUND_START] ←──────────────────────────────┐
  |                                           |
  | (자동, 즉시)                               |
  v                                           |
[COLOR_REVEAL] ── 3초 ──→ [COLOR_SELECTION]  |
                               |              |
                               | 10초         |
                               v              |
                           [TIME_UP]          |
                               |              |
                               | 2초          |
                               v              |
                           [COMPARISON]       |
                               |              |
                               | 5초          |
                               v              |
                           [SCORING] ─────────┤ (라운드 < 8)
                               |              |
                               | (라운드 == 8)|
                               v              |
                           [GAME_OVER]        |
                               |
                               | [다시하기] 선택자들
                               v
                           [REPLAY_LOBBY]
```

### 6.2 각 상태 상세 정의

| 상태 | 설명 | 진입 조건 | 탈출 조건 | 소요 시간 |
|------|------|-----------|-----------|-----------|
| `IDLE` | 초기 상태, 홈 화면 | 앱 시작 | 게임 만들기/참여 | - |
| `LOBBY` | 대기실 | 룸 생성/참여 완료 | 호스트가 시작 클릭 | 무제한 |
| `ROUND_START` | 라운드 초기화 | 이전 라운드 종료 | 즉시 COLOR_REVEAL | ~0 |
| `COLOR_REVEAL` | 타겟 컬러 표시 | ROUND_START | 3초 경과 | 3초 |
| `COLOR_SELECTION` | 컬러 피커 활성화 | COLOR_REVEAL 종료 | 10초 경과 | 10초 |
| `TIME_UP` | 시간 종료 메세지 | COLOR_SELECTION 종료 | 2초 경과 | 2초 |
| `COMPARISON` | 결과 비교 + 분석 중 | TIME_UP 종료 | 5초 경과 | 5초 |
| `SCORING` | 점수 산정 및 하이라이트 | COMPARISON 종료 | 3초 경과 | 3초 |
| `GAME_OVER` | 최종 결과 | 8라운드 SCORING 종료 | 재시작/나가기 | 무제한 |
| `REPLAY_LOBBY` | 재시작 대기 | [다시하기] 선택 | 모든 응답 수집 | 최대 60초 |

### 6.3 호스트 / 게스트 역할 분리

| 동작 | 호스트 | 게스트 |
|------|--------|--------|
| 타이머 제어 | O (setInterval) | X (수신만) |
| 페이즈 전환 | O (브로드캐스트) | X (수신 후 상태 업데이트) |
| 랜덤 컬러 생성 | O (라운드 시작 시 생성 및 배포) | X (수신) |
| 컬러 선택 전송 | O (자기 자신에게 적용) | O (호스트에 전송) |
| 점수 계산 | O (모든 선택 수신 후 계산) | X (수신) |
| 결과 배포 | O | X |

---

## 7. 데이터 구조 설계

### 7.1 핵심 타입 정의

```typescript
// types/game.types.ts

export interface RGBColor {
  r: number;  // 0~255
  g: number;  // 0~255
  b: number;  // 0~255
}

export interface Player {
  id: string;           // PeerJS peer ID (호스트는 roomId와 동일)
  nickname: string;     // 닉네임 (최대 10자)
  profileColor: RGBColor;  // 프로필 아바타 배경색
  isHost: boolean;      // 호스트 여부
  score: number;        // 누적 점수
  isConnected: boolean; // 연결 상태
}

export type GamePhase =
  | 'IDLE'
  | 'LOBBY'
  | 'ROUND_START'
  | 'COLOR_REVEAL'
  | 'COLOR_SELECTION'
  | 'TIME_UP'
  | 'COMPARISON'
  | 'SCORING'
  | 'GAME_OVER'
  | 'REPLAY_LOBBY';

export interface RoundResult {
  roundNumber: number;
  targetColor: RGBColor;
  playerPicks: Record<string, RGBColor>;  // playerId -> 선택한 컬러
  ranking: RoundRank[];                   // 순위 배열
}

export interface RoundRank {
  playerId: string;
  distance: number;   // 타겟 컬러와의 유클리디안 거리
  rank: number;       // 1위부터 시작
  pointsEarned: number; // 이번 라운드에서 획득한 점수
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  currentRound: number;  // 1~8
  totalRounds: number;   // 8
  targetColor: RGBColor | null;
  playerPicks: Record<string, RGBColor>;  // 현재 라운드 선택값
  roundResults: RoundResult[];            // 지금까지의 라운드 결과
  gameStarted: boolean;   // 게임 시작 여부 (중간 참여 방지)
  replayVotes: Record<string, boolean>;   // 재시작 투표 결과
}
```

### 7.2 PeerJS 메세지 타입

```typescript
// types/peer.types.ts

export type PeerMessageType =
  | 'PLAYER_JOIN'        // 게스트 → 호스트: 참여 요청
  | 'PLAYER_JOIN_ACK'    // 호스트 → 게스트: 참여 승인 + 현재 상태 전달
  | 'PLAYER_JOIN_REJECT' // 호스트 → 게스트: 참여 거부
  | 'PLAYER_LEAVE'       // 누구든 → 호스트: 연결 해제 알림
  | 'STATE_SYNC'         // 호스트 → 전체: 전체 게임 상태 동기화
  | 'PHASE_CHANGE'       // 호스트 → 전체: 페이즈 전환
  | 'COLOR_PICK'         // 게스트 → 호스트: 컬러 선택값 전송
  | 'ROUND_RESULT'       // 호스트 → 전체: 라운드 결과 배포
  | 'REPLAY_VOTE'        // 게스트 → 호스트: 재시작 투표
  | 'NEW_GAME_READY';    // 호스트 → 전체: 새 게임 룸 정보

export interface PeerMessage {
  type: PeerMessageType;
  payload: unknown;
  timestamp: number;
}

// 메세지별 payload 타입 예시
export interface PlayerJoinPayload {
  nickname: string;
  profileColor: RGBColor;
  peerId: string;
}

export interface ColorPickPayload {
  playerId: string;
  color: RGBColor;
}

export interface PhaseChangePayload {
  phase: GamePhase;
  targetColor?: RGBColor;  // COLOR_REVEAL 페이즈 전환 시 포함
  roundNumber?: number;
}
```

### 7.3 GameContext Reducer 액션 타입

```typescript
export type GameAction =
  | { type: 'SET_ROOM'; payload: { roomId: string; isHost: boolean } }
  | { type: 'ADD_PLAYER'; payload: Player }
  | { type: 'REMOVE_PLAYER'; payload: { playerId: string } }
  | { type: 'SET_PHASE'; payload: { phase: GamePhase } }
  | { type: 'SET_TARGET_COLOR'; payload: { color: RGBColor } }
  | { type: 'SET_PLAYER_PICK'; payload: { playerId: string; color: RGBColor } }
  | { type: 'APPLY_ROUND_RESULT'; payload: RoundResult }
  | { type: 'RESET_ROUND' }
  | { type: 'SET_REPLAY_VOTE'; payload: { playerId: string; vote: boolean } }
  | { type: 'RESET_GAME' };
```

### 7.4 컬러 유틸리티 함수

```typescript
// utils/colorUtils.ts

// RGB 유클리디안 거리 계산
const colorDistance = (c1: RGBColor, c2: RGBColor): number =>
  Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );

// 랜덤 RGB 컬러 생성
const randomRGBColor = (): RGBColor => ({
  r: Math.floor(Math.random() * 256),
  g: Math.floor(Math.random() * 256),
  b: Math.floor(Math.random() * 256),
});

// RGB → HEX 변환
const rgbToHex = (color: RGBColor): string =>
  `#${[color.r, color.g, color.b]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;

// 근사도 퍼센트 계산 (싱글 플레이용)
const MAX_DISTANCE = Math.sqrt(255 ** 2 + 255 ** 2 + 255 ** 2); // ≈ 441.67
const accuracyPercent = (distance: number): number =>
  Math.round((1 - distance / MAX_DISTANCE) * 100);
```

---

## 8. 화면 설계 (페이지 목록 및 컴포넌트 구조)

### 8.1 페이지 라우팅

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | `HomePage` | 게임 만들기 / 참여하기 |
| `/game/:roomId` | `LobbyPage` + `GamePage` + `ResultPage` | 룸 전체 흐름 (phase에 따라 화면 전환) |

> 참고: `/game/:roomId` 단일 경로에서 `GameContext`의 `phase`를 기반으로 조건부 렌더링을 수행한다. React Router의 중첩 라우트 또는 단순 조건 분기 모두 가능하다.

### 8.2 컴포넌트 구조 및 책임

#### HomePage

```
HomePage
├── CreateGameForm (게임 만들기 클릭 시 표시)
│   ├── NicknameInput
│   └── ProfileColorPicker
└── JoinGameForm (게임 참여하기 클릭 시 표시)
    ├── NicknameInput
    ├── ProfileColorPicker
    └── InviteLinkInput
```

#### LobbyPage (phase === 'LOBBY')

```
LobbyPage
├── InviteLinkDisplay (초대 링크 + 복사 버튼)
├── PlayerGrid (연결된 플레이어 목록)
│   └── PlayerProfile[] (원형 아바타 + 닉네임 + 방장 배지)
└── StartGameButton (호스트에게만 표시)
```

#### GamePage (phase: COLOR_REVEAL ~ SCORING)

```
GamePage
├── RoundHeader (현재 라운드 번호 + 누적 점수 요약)
├── Timer (카운트다운 숫자 또는 "시간 종료!" 텍스트)
│
├── [COLOR_REVEAL phase]
│   └── ColorBox (800×800, 랜덤 컬러 배경)
│
├── [COLOR_SELECTION phase]
│   ├── SelectedColorBackground (전체 배경 = 선택 중인 컬러)
│   └── ColorPicker (fixed overlay)
│       ├── RGBSlider (R)
│       ├── RGBSlider (G)
│       ├── RGBSlider (B)
│       └── ColorPreview (현재 선택 컬러 + HEX/RGB 코드)
│
├── [COMPARISON / SCORING phase]
│   └── ComparisonGrid (grid-cols-{n}, grid-rows-2)
│       ├── TargetColorCells[] (row 1: 모든 열에 타겟 컬러)
│       └── PlayerPickCells[] (row 2: 플레이어별 선택 컬러)
│           └── RoundHighlight (1~3위 글로우 + 배지)
│
└── PlayerGrid (화면 하단, 항상 표시)
    └── PlayerProfile[] (원형 아바타 + 닉네임)
```

#### ResultPage (phase === 'GAME_OVER')

```
ResultPage
├── FinalScoreboard
│   └── RankingCard[] (순위, 아바타, 닉네임, 총점)
├── ReplayButton ([다시하기])
├── ExitButton ([나가기])
└── WaitingStatus (다른 플레이어들의 선택 대기 현황)
```

### 8.3 주요 화면 레이아웃 스케치

#### Phase 1: COLOR_REVEAL

```
┌─────────────────────────────────────────────────────────┐
│  Round 3/8                           [총점: 플레이어명 5] │
│                      3               타이머              │
│                                                          │
│              ┌────────────────┐                          │
│              │                │                          │
│              │  (랜덤 컬러)    │  800×800                │
│              │                │                          │
│              └────────────────┘                          │
│                                                          │
│  ●Alice  ●Bob  ●Carol  ●Dave        (플레이어 그리드)    │
└─────────────────────────────────────────────────────────┘
```

#### Phase 2: COLOR_SELECTION

```
┌─────────────────────────────────────────────────────────┐
│  (선택 중인 컬러가 배경색으로 채워짐)                    │
│                                                          │
│  ┌─────────────────────────────────────────────┐ fixed  │
│  │  RGB Color Picker                            │        │
│  │  R: ━━━━━━●━━━━━  127                       │        │
│  │  G: ━━●━━━━━━━━━  56                        │        │
│  │  B: ━━━━━━━━●━━━  201                       │        │
│  │                                              │        │
│  │  [███] #7F38C9  rgb(127, 56, 201)           │        │
│  └─────────────────────────────────────────────┘        │
│                                                          │
│                              ▲ 10초 타이머               │
└─────────────────────────────────────────────────────────┘
```

#### Phase 3: COMPARISON (4인 플레이 기준)

```
┌──────────┬──────────┬──────────┬──────────┐
│ Target   │ Target   │ Target   │ Target   │  Row 1
│ (원본)   │ (원본)   │ (원본)   │ (원본)   │
├──────────┼──────────┼──────────┼──────────┤
│ Alice    │ Bob      │ Carol    │ Dave     │  Row 2
│ (선택)   │ (선택)   │ (선택)   │ (선택)   │
│ rgb(...) │ rgb(...) │ rgb(...) │ rgb(...) │
└──────────┴──────────┴──────────┴──────────┘
             "분석 중..." (중앙 오버레이)
```

---

## 9. 개발 우선순위 및 마일스톤

### 9.1 마일스톤 개요

```
M1: 싱글 플레이 게임 루프 완성 (1주)
M2: 멀티플레이 PeerJS 연동 (1주)
M3: UI 완성도 및 애니메이션 (3일)
M4: 엣지 케이스 처리 및 QA (2일)
```

### 9.2 상세 태스크 및 우선순위

#### Milestone 1 — 싱글 플레이 게임 루프 (Priority: Critical)

| 태스크 | 우선순위 | 예상 소요 |
|--------|----------|-----------|
| 프로젝트 초기 셋업 (Vite + React + TS + Tailwind + Router) | P0 | 0.5일 |
| `game.types.ts` 타입 정의 전체 작성 | P0 | 0.5일 |
| `GameContext` + Reducer 구현 | P0 | 1일 |
| `colorUtils.ts` (거리 계산, 랜덤 컬러, HEX 변환) | P0 | 0.5일 |
| `HomePage` — 게임 만들기 폼 | P0 | 0.5일 |
| `LobbyPage` — 대기실 (싱글용) | P0 | 0.5일 |
| `GamePage` — COLOR_REVEAL Phase | P0 | 0.5일 |
| `GamePage` — COLOR_SELECTION Phase + ColorPicker | P0 | 1일 |
| `GamePage` — COMPARISON + SCORING Phase | P0 | 1일 |
| `ResultPage` — 최종 결과 화면 | P0 | 0.5일 |
| 싱글 플레이 전체 루프 통합 테스트 | P0 | 0.5일 |

#### Milestone 2 — 멀티플레이 PeerJS 연동 (Priority: High)

| 태스크 | 우선순위 | 예상 소요 |
|--------|----------|-----------|
| PeerJS 설치 및 `usePeer.ts` 훅 구현 | P1 | 1일 |
| 호스트 Peer 생성 및 룸 ID 기반 초대 링크 생성 | P1 | 0.5일 |
| 게스트 연결 로직 (초대 링크 파싱 → Peer 연결) | P1 | 0.5일 |
| `peer.types.ts` 메세지 타입 정의 | P1 | 0.5일 |
| 호스트 브로드캐스트 및 상태 동기화 구현 | P1 | 1일 |
| 게스트 컬러 선택값 → 호스트 전송 | P1 | 0.5일 |
| 타이머 동기화 (호스트 제어) | P1 | 0.5일 |
| 재시작 투표 로직 (REPLAY_VOTE) | P1 | 0.5일 |
| 멀티플레이 통합 테스트 (2인 기준) | P1 | 1일 |

#### Milestone 3 — UI 완성도 (Priority: Medium)

| 태스크 | 우선순위 | 예상 소요 |
|--------|----------|-----------|
| `RoundHighlight` — 1~3위 글로우 + 배지 애니메이션 | P2 | 0.5일 |
| `Timer` — 카운트다운 시각적 표현 강화 | P2 | 0.5일 |
| `ComparisonGrid` — 컬러 코드 표시 스타일링 | P2 | 0.5일 |
| 전체 페이지 반응형 레이아웃 점검 | P2 | 0.5일 |
| "분석 중..." 오버레이 애니메이션 | P2 | 0.5일 |

#### Milestone 4 — 엣지 케이스 및 QA (Priority: Medium)

| 태스크 | 우선순위 | 예상 소요 |
|--------|----------|-----------|
| 호스트 연결 끊김 처리 (게스트에게 알림) | P2 | 0.5일 |
| 게스트 연결 끊김 처리 (호스트에서 제거) | P2 | 0.5일 |
| 게임 중 참여 시도 거부 처리 | P2 | 0.5일 |
| 8명 초과 참여 거부 처리 | P2 | 0.5일 |

---

## 10. 기술적 제약사항 및 리스크

### 10.1 PeerJS 관련 제약사항

| 제약사항 | 내용 | 대응 방안 |
|----------|------|-----------|
| **PeerJS 클라우드 서버 의존성** | 무료 PeerJS 서버(`0.peerjs.com`)는 공개 브로커 서버로 SLA 미보장 | 서버 다운 시 에러 메세지 표시 + 재연결 버튼 제공 |
| **NAT Traversal 실패** | 일부 기업 방화벽/NAT 환경에서 WebRTC TURN 서버 없이 직접 연결 불가 | TURN 서버 없이 연결 실패 시 "네트워크 환경을 확인해주세요" 안내 |
| **동시 접속 제한** | PeerJS 무료 서버는 동시 연결 수에 비공식 제한이 있을 수 있음 | 로컬 자가 호스팅 PeerJS 서버 옵션 안내 문서화 |
| **모바일 환경** | 모바일 브라우저에서 WebRTC 제한 가능 | 데스크탑 우선 정책, 모바일은 "지원 예정" 안내 |

### 10.2 타이머 동기화 리스크

| 리스크 | 설명 | 대응 방안 |
|--------|------|-----------|
| **클라이언트 간 타이머 편차** | 호스트와 게스트 간 네트워크 레이턴시로 인해 페이즈 전환 타이밍이 수십ms 차이 발생 | 호스트가 페이즈 전환 시 `timestamp`를 포함해 브로드캐스트, 게스트는 수신 시각 기반으로 타이머 오프셋 보정 |
| **호스트 탭 백그라운드 진입** | 호스트가 탭을 전환하면 `setInterval`이 throttle 되어 타이머 지연 | `visibilitychange` 이벤트 감지, `Date.now()` 기반 경과 시간 계산으로 interval 보정 |

### 10.3 상태 동기화 리스크

| 리스크 | 설명 | 대응 방안 |
|--------|------|-----------|
| **게스트 컬러 전송 지연** | 10초 마감 직전에 전송된 컬러 선택값이 TIME_UP 이후 호스트에 도달할 수 있음 | 호스트가 TIME_UP 이후 200ms 버퍼를 두고 점수 계산 시작 |
| **호스트 연결 끊김** | 호스트가 게임 중 탭을 닫으면 모든 게스트가 고립됨 | 호스트 연결 끊김 감지 시 "방장이 연결을 끊었습니다" 알림, 결과 페이지로 이동 |

### 10.4 브라우저 저장소 제약

| 제약사항 | 내용 | 대응 방안 |
|----------|------|-----------|
| **localStorage 미사용** | 게임 상태는 인메모리 React 상태로만 관리 (탭 새로고침 시 소멸) | 새로고침 감지 시 "새로고침하면 게임이 종료됩니다" 경고 표시 |
| **시크릿 모드** | PeerJS 관련 쿠키/저장소 제한 가능 | 시크릿 모드 특별 처리 불필요, WebRTC는 메모리 기반으로 동작 |

### 10.5 개발 환경 제약

| 제약사항 | 내용 |
|----------|------|
| **서버 없음** | Express, Node.js, WebSocket 서버 등 모든 서버사이드 코드 없음 |
| **정적 배포** | Vercel, Netlify, GitHub Pages 등 정적 호스팅 서비스 배포 가능 |
| **API 키 없음** | Firebase 등 외부 서비스 미사용, 순수 PeerJS P2P |

### 10.6 설치 의존성 목록

```bash
# 프로젝트 생성
npm create vite@latest color-game -- --template react-ts

# 핵심 의존성
npm install react-router-dom peerjs nanoid

# 개발 의존성
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
```

---

## 부록 A: 초대 링크 흐름 요약

```
1. 호스트: roomId = nanoid(10) → "ab3kX9mPqZ"
2. 초대 링크: https://color-game.vercel.app/game/ab3kX9mPqZ
3. 게스트: 링크 접속 → URL에서 roomId 추출
4. 게스트: new Peer() → peer.connect("ab3kX9mPqZ") 호출
5. 호스트: peer.on('connection') → 게스트 수락/거부 처리
6. 연결 성공: 양방향 DataConnection 확립
```

## 부록 B: 점수 계산 예시

```
타겟 컬러: rgb(200, 100, 50)

플레이어A: rgb(195, 98, 55)  → distance ≈ 7.07  → 1위 → 3점
플레이어B: rgb(180, 110, 40) → distance ≈ 22.38 → 2위 → 2점
플레이어C: rgb(150, 80, 80)  → distance ≈ 58.31 → 3위 → 1점
플레이어D: rgb(100, 200, 10) → distance ≈ 160.2 → 4위 → 0점
```

---

*이 문서는 Color Match 게임의 v1.0.0 기획 기준으로 작성되었으며, 구현 진행에 따라 업데이트될 수 있습니다.*
