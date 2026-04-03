// 게임 진행 단계 타입
export type GamePhase =
  | 'WAITING'          // 로비 대기 중
  | 'COLOR_REVEAL'     // 타겟 컬러 공개 (3초)
  | 'COLOR_SELECTION'  // 플레이어 컬러 선택 (10초)
  | 'TIME_UP'          // 시간 초과 메시지 (2초)
  | 'COMPARISON'       // 컬러 비교 화면 (5초)
  | 'SCORING'          // 점수 계산 및 표시
  | 'NEXT_ROUND'       // 다음 라운드 준비
  | 'FINISHED';        // 게임 종료

// RGB 컬러 타입
export interface RGB {
  r: number;
  g: number;
  b: number;
}

// 플레이어 타입
export interface Player {
  id: string;
  nickname: string;
  profileColor: string; // hex 문자열 (예: "#ff5733")
  score: number;
  isHost: boolean;
  isReady: boolean;
  currentPick?: RGB;
  hasSubmitted: boolean;
}

// 라운드 결과 타입
export interface RoundResult {
  round: number;
  targetColor: RGB;
  picks: Record<string, RGB>;    // playerId -> 선택한 RGB
  scores: Record<string, number>; // playerId -> 이번 라운드 획득 점수
  ranking: string[];              // playerId 배열 (1위부터 가까운 순)
}

// 전체 게임 상태 타입
export interface GameState {
  gameId: string;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  targetColor: RGB | null;
  players: Player[];
  roundResults: RoundResult[];
  phaseStartTime: number | null; // Date.now() 기준 타임스탬프
  myPlayerId: string;
}

// PeerJS 메시지 타입
export type PeerMessageType =
  | 'PLAYER_JOIN'       // 플레이어 참가
  | 'PLAYER_LEAVE'      // 플레이어 퇴장
  | 'GAME_STATE_SYNC'   // 호스트 → 게스트: 전체 상태 동기화
  | 'COLOR_PICK'        // 게스트 → 호스트: 컬러 선택 전송
  | 'PHASE_CHANGE'      // 호스트 → 게스트: 페이즈 변경
  | 'GAME_START'        // 호스트 → 게스트: 게임 시작
  | 'PLAY_AGAIN_VOTE'   // 다시하기 투표
  | 'ROUND_RESULT';    // 호스트 → 게스트: 라운드 결과 동기화

// PeerJS 메시지 구조
export interface PeerMessage {
  type: PeerMessageType;
  payload: unknown;
  senderId: string;
  timestamp: number;
}

// 다시하기 투표 페이로드
export interface PlayAgainVotePayload {
  playerId: string;
  vote: 'again' | 'leave';
}

// 컬러 픽 페이로드
export interface ColorPickPayload {
  playerId: string;
  color: RGB;
}

// 플레이어 참가 페이로드
export interface PlayerJoinPayload {
  player: Player;
}
