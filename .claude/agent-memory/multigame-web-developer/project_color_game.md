---
name: Color Match 프로젝트 개요
description: RGB 컬러 근사값 맞추기 멀티플레이어 게임 프로젝트의 핵심 기획 및 기술 결정사항
type: project
---

서버리스 멀티플레이 브라우저 게임 "Color Match" 개발 프로젝트.
PRD 문서는 /Users/metz/Desktop/color_game/PRD.md에 저장되어 있음.

**Why:** 백엔드 지식이 없는 프론트엔드 개발자가 개발하므로, 순수 클라이언트사이드 기술만 사용.

**핵심 기술 결정:**
- 멀티플레이: PeerJS (WebRTC 래퍼) — 호스트 Peer ID = roomId
- 빌드: Vite + React + TypeScript + Tailwind CSS v4 (@tailwindcss/vite) + React Router DOM v7
- 상태관리: useReducer (useGame 훅) — GameContext 없이 훅 기반으로 구현
- 방 ID 생성: crypto.randomUUID() 기반 (cm-XXXXXXXX 형식)
- 서버: 없음 (정적 배포 — Vercel/Netlify 등)
- 플레이어 정보 공유: sessionStorage (playerInfo, gamePlayers, myPlayerId)

**게임 규칙:**
- 최대 8인, 8라운드, 초대 링크 기반 참여, 중간 참여 불가
- 점수: 1위 2점, 2위 1점 (RGB 유클리디안 거리 기반)
- 싱글 플레이 지원 (PeerJS 없이 로컬 상태만 사용)

**프로젝트 구조 (2026-04-03 기준 Phase 로직 연결 완료):**
- src/types/game.ts — 모든 게임 타입 정의 (PeerMessageType에 ROUND_RESULT 추가됨)
- src/utils/colorUtils.ts — randomRGB, rgbDistance, calculateRoundScores 등
- src/utils/peerUtils.ts — generateRoomId, generateInviteLink, createPeerMessage
- src/hooks/useTimer.ts — resetKey prop 추가 (phase 전환 시 타이머 리셋용)
- src/hooks/usePeer.ts — PeerJS 연결 추상화
- src/hooks/useGame.ts — useReducer 기반 게임 상태 관리 (NEXT_ROUND가 플레이어 초기화만 담당, targetColor는 syncState로 별도 설정)
- src/components/ — ColorBox, ColorPicker, PlayerCard, Timer, ScoreBoard, CompareGrid
- src/pages/ — Home, Lobby, Game, Result
- 라우팅: / → /lobby/:gameId → /game/:gameId → /result/:gameId

**Game.tsx Phase 전환 흐름 (2026-04-03 완성):**
COLOR_REVEAL(3s) → COLOR_SELECTION(10s) → TIME_UP(2s) → COMPARISON(5s) → SCORING(3s) → [다음 라운드 or FINISHED]
- COLOR_SELECTION 종료 시: computeRoundResult()로 결과 즉시 계산 → lastRoundResult state에 저장 → 게스트에게 ROUND_RESULT 브로드캐스트
- COMPARISON: lastRoundResult로 CompareGrid 렌더링 (분석 중... 표시)
- SCORING: calculateRound() dispatch + 점수 하이라이트 렌더링
- 타이머 리셋: useTimer의 resetKey prop 사용 (timerKey state 증가로 트리거)
- sendToAll stale closure 방지: sendToAllRef.current 패턴 사용

**Lobby.tsx 핵심 패턴:**
- sendToAll을 ref(sendToAllRef)로 관리 — onMessage 콜백 내 순환 의존성 방지
- 게스트/호스트 모두 myPlayerId를 sessionStorage에 저장 (Game.tsx에서 읽음)
- 호스트만 gamePlayers를 sessionStorage에 저장 → 게스트 판별 기준

**게스트 판별 로직 (Game.tsx loadGameData):**
- gamePlayers가 sessionStorage에 없으면 게스트(isHost=false)로 간주
- 게스트는 빈 players 배열로 시작, 호스트 GAME_STATE_SYNC로 동기화

**Tailwind CSS v4 설정:**
- vite.config.ts에서 @tailwindcss/vite 플러그인 사용
- index.css에 `@import "tailwindcss";` 한 줄만 추가
- tsconfig.app.json: noUncheckedSideEffectImports = false (CSS import 허용)

**How to apply:** 이 프로젝트의 모든 구현 작업은 서버 코드 없이 진행. Express/Node.js/WebSocket 서버 제안 금지.
PRD.md는 절대 수정하지 말 것.
