import { useReducer, useCallback } from 'react';
import type { GameState, GamePhase, Player, RGB, RoundResult } from '../types/game';
import { calculateRoundScores } from '../utils/colorUtils';

// 게임 액션 타입 정의
type GameAction =
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'ADD_PLAYER'; payload: Player }
  | { type: 'REMOVE_PLAYER'; payload: string } // playerId
  | { type: 'SET_PHASE'; payload: GamePhase }
  | { type: 'SET_TARGET_COLOR'; payload: RGB }
  | { type: 'SUBMIT_COLOR_PICK'; payload: { playerId: string; color: RGB } }
  | { type: 'CALCULATE_ROUND'; }
  | { type: 'NEXT_ROUND' }
  | { type: 'SYNC_STATE'; payload: Partial<GameState> }
  | { type: 'RESET_GAME' };

// 초기 게임 상태
const createInitialState = (gameId: string, myPlayerId: string): GameState => ({
  gameId,
  phase: 'WAITING',
  currentRound: 0,
  totalRounds: 8,
  targetColor: null,
  players: [],
  roundResults: [],
  phaseStartTime: null,
  myPlayerId,
});

// 게임 상태 리듀서
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };

    case 'ADD_PLAYER': {
      const exists = state.players.find((p) => p.id === action.payload.id);
      if (exists) return state;
      return { ...state, players: [...state.players, action.payload] };
    }

    case 'REMOVE_PLAYER':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.payload),
      };

    case 'SET_PHASE':
      return { ...state, phase: action.payload, phaseStartTime: Date.now() };

    case 'SET_TARGET_COLOR':
      return { ...state, targetColor: action.payload };

    case 'SUBMIT_COLOR_PICK':
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.payload.playerId
            ? { ...p, currentPick: action.payload.color, hasSubmitted: true }
            : p
        ),
      };

    case 'CALCULATE_ROUND': {
      if (!state.targetColor) return state;

      // 제출한 플레이어의 픽만 수집
      const picks: Record<string, RGB> = {};
      state.players.forEach((p) => {
        if (p.currentPick && p.hasSubmitted) {
          picks[p.id] = p.currentPick;
        }
      });

      const { scores, ranking } = calculateRoundScores(state.targetColor, picks);

      const roundResult: RoundResult = {
        round: state.currentRound,
        targetColor: state.targetColor,
        picks,
        scores,
        ranking,
      };

      // 플레이어 점수 업데이트
      const updatedPlayers = state.players.map((p) => ({
        ...p,
        score: p.score + (scores[p.id] ?? 0),
      }));

      return {
        ...state,
        players: updatedPlayers,
        roundResults: [...state.roundResults, roundResult],
      };
    }

    case 'NEXT_ROUND': {
      // 플레이어 제출 상태만 초기화
      // targetColor와 currentRound는 호스트가 SYNC_STATE로 별도 업데이트
      return {
        ...state,
        players: state.players.map((p) => ({
          ...p,
          currentPick: undefined,
          hasSubmitted: false,
        })),
      };
    }

    case 'SYNC_STATE':
      return { ...state, ...action.payload };

    case 'RESET_GAME':
      return {
        ...createInitialState(state.gameId, state.myPlayerId),
        // 플레이어 정보는 유지하되 점수 초기화
        players: state.players.map((p) => ({
          ...p,
          score: 0,
          currentPick: undefined,
          hasSubmitted: false,
        })),
      };

    default:
      return state;
  }
}

// useGame 훅
export function useGame(gameId: string, myPlayerId: string) {
  const [state, dispatch] = useReducer(
    gameReducer,
    null,
    () => createInitialState(gameId, myPlayerId)
  );

  const addPlayer = useCallback((player: Player) => {
    dispatch({ type: 'ADD_PLAYER', payload: player });
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    dispatch({ type: 'REMOVE_PLAYER', payload: playerId });
  }, []);

  const setPhase = useCallback((phase: GamePhase) => {
    dispatch({ type: 'SET_PHASE', payload: phase });
  }, []);

  const startNextRound = useCallback(() => {
    dispatch({ type: 'NEXT_ROUND' });
  }, []);

  const submitColorPick = useCallback((playerId: string, color: RGB) => {
    dispatch({ type: 'SUBMIT_COLOR_PICK', payload: { playerId, color } });
  }, []);

  const calculateRound = useCallback(() => {
    dispatch({ type: 'CALCULATE_ROUND' });
  }, []);

  const syncState = useCallback((partial: Partial<GameState>) => {
    dispatch({ type: 'SYNC_STATE', payload: partial });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME' });
  }, []);

  // 현재 플레이어 (자신)
  const myPlayer = state.players.find((p) => p.id === myPlayerId);

  // 모든 플레이어가 제출했는지 확인
  const allSubmitted =
    state.players.length > 0 && state.players.every((p) => p.hasSubmitted);

  // 현재 라운드의 결과
  const currentRoundResult = state.roundResults[state.currentRound - 1];

  return {
    state,
    myPlayer,
    allSubmitted,
    currentRoundResult,
    addPlayer,
    removePlayer,
    setPhase,
    startNextRound,
    submitColorPick,
    calculateRound,
    syncState,
    resetGame,
  };
}
