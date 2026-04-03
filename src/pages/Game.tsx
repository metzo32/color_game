import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { DataConnection } from 'peerjs';
import type { Player, RGB, GamePhase, PeerMessage, RoundResult } from '../types/game';
import { usePeer } from '../hooks/usePeer';
import { useTimer } from '../hooks/useTimer';
import { useGame } from '../hooks/useGame';
import ColorBox from '../components/ColorBox';
import ColorPicker from '../components/ColorPicker';
import Timer from '../components/Timer';
import CompareGrid from '../components/CompareGrid';
import ScoreBoard from '../components/ScoreBoard';
import PlayerCard from '../components/PlayerCard';
import { randomRGB } from '../utils/colorUtils';
import { createPeerMessage } from '../utils/peerUtils';

// sessionStorage에서 저장된 게임 데이터 불러오기
function loadGameData(): { players: Player[]; myPlayerId: string; isHost: boolean } | null {
  try {
    const playersRaw = sessionStorage.getItem('gamePlayers');
    const myPlayerId = sessionStorage.getItem('myPlayerId') ?? '';
    const playerInfo = sessionStorage.getItem('playerInfo');

    // gamePlayers가 없으면 게스트이거나 단독 플레이 처음 시작
    if (!playersRaw) {
      if (!playerInfo || !myPlayerId) return null;
      // 게스트: playerInfo만으로 자신 정보 구성 (플레이어 목록은 호스트 sync로 받음)
      // 단독 플레이: isHost=true로 처리
      // 게스트와 단독의 차이는 URL의 host 파라미터로 구분할 수 없으므로
      // myPlayerId가 있고 gamePlayers가 없으면 게스트로 간주 (isHost=false)
      // → Lobby가 게스트에게 gamePlayers를 저장하지 않으므로 게스트 판별 가능
      const info = JSON.parse(playerInfo) as { nickname: string; profileColor: string };
      const me: Player = {
        id: myPlayerId,
        nickname: info.nickname,
        profileColor: info.profileColor,
        score: 0,
        isHost: false, // gamePlayers 없으면 게스트
        isReady: true,
        hasSubmitted: false,
      };
      return { players: [me], myPlayerId, isHost: false };
    }

    if (!myPlayerId) return null;

    const players = JSON.parse(playersRaw) as Player[];
    const myPlayerData = players.find((p) => p.id === myPlayerId);
    const isHost = myPlayerData?.isHost ?? false;

    // 플레이어 목록이 비어있고 playerInfo만 있는 경우 (단독 플레이)
    if (players.length === 0 && playerInfo) {
      const info = JSON.parse(playerInfo) as { nickname: string; profileColor: string };
      const singlePlayer: Player = {
        id: myPlayerId || crypto.randomUUID(),
        nickname: info.nickname,
        profileColor: info.profileColor,
        score: 0,
        isHost: true,
        isReady: true,
        hasSubmitted: false,
      };
      return { players: [singlePlayer], myPlayerId: singlePlayer.id, isHost: true };
    }

    return { players, myPlayerId, isHost };
  } catch {
    return null;
  }
}

// 페이즈별 지속 시간 (초)
const PHASE_DURATIONS: Partial<Record<GamePhase, number>> = {
  COLOR_REVEAL: 3,
  COLOR_SELECTION: 10,
  TIME_UP: 2,
  COMPARISON: 5,
  SCORING: 3,
};

// 순위별 하이라이트 스타일
const RANK_HIGHLIGHTS: Record<number, { badge: string; glow: string; label: string }> = {
  0: { badge: 'bg-yellow-400 text-gray-900', glow: 'ring-2 ring-yellow-400', label: '1위' },
  1: { badge: 'bg-gray-300 text-gray-900', glow: 'ring-2 ring-gray-300', label: '2위' },
  2: { badge: 'bg-orange-400 text-white', glow: 'ring-2 ring-orange-400', label: '3위' },
};

// 플레이어 픽을 기반으로 라운드 결과 즉시 계산 (dispatch와 별개)
function computeRoundResult(
  round: number,
  targetColor: RGB,
  players: Player[]
): RoundResult {
  const picks: Record<string, RGB> = {};
  players.forEach((p) => {
    if (p.currentPick && p.hasSubmitted) {
      picks[p.id] = p.currentPick;
    }
  });

  const distances = Object.entries(picks).map(([playerId, color]) => {
    const dr = targetColor.r - color.r;
    const dg = targetColor.g - color.g;
    const db = targetColor.b - color.b;
    return { playerId, distance: Math.sqrt(dr * dr + dg * dg + db * db) };
  });
  distances.sort((a, b) => a.distance - b.distance);

  const scores: Record<string, number> = {};
  const ranking = distances.map((d) => d.playerId);
  ranking.forEach((id) => (scores[id] = 0));
  // 1위 2점, 2위 1점
  if (ranking.length >= 1) scores[ranking[0]] = 2;
  if (ranking.length >= 2) scores[ranking[1]] = 1;

  return { round, targetColor, picks, scores, ranking };
}

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  // 게임 데이터는 컴포넌트 생애 동안 변하지 않으므로 ref로 보관
  const gameDataRef = useRef(loadGameData());
  const myPlayerId = gameDataRef.current?.myPlayerId ?? crypto.randomUUID();
  const isHost = gameDataRef.current?.isHost ?? true;

  // 싱글플레이 판별: 플레이어가 1명(자신만)이고 호스트인 경우 PeerJS 비활성화
  // PeerJS 공개 서버(0.peerjs.com) 불필요한 WebSocket 연결을 방지
  const isSinglePlayer = isHost && (gameDataRef.current?.players.length ?? 0) <= 1;

  const {
    state,
    myPlayer,
    allSubmitted,
    addPlayer,
    setPhase,
    startNextRound,
    submitColorPick,
    calculateRound,
    syncState,
  } = useGame(gameId ?? '', myPlayerId);

  // 타이머 duration과 key를 분리 관리
  const [timerDuration, setTimerDuration] = useState(PHASE_DURATIONS.COLOR_REVEAL ?? 3);
  const [timerKey, setTimerKey] = useState(0);

  // 현재 페이즈를 ref로도 관리 (stale closure 방지)
  const phaseRef = useRef<GamePhase>('WAITING');
  const hostConnRef = useRef<DataConnection | null>(null);

  // 라운드 결과: COMPARISON/SCORING 렌더링에 사용
  // COLOR_SELECTION 종료 시점에 계산하여 저장
  const [lastRoundResult, setLastRoundResult] = useState<RoundResult | null>(null);

  // sendToAll을 ref로 관리하여 stale closure 방지
  const sendToAllRef = useRef<(type: PeerMessage['type'], payload: unknown) => void>(() => {});

  // state를 직접 참조하지 않고 ref를 통해 최신값 접근 (advancePhase stale closure 방지)
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // 페이즈 전환 헬퍼: 타이머 리셋 + 게스트 브로드캐스트
  const transitionToPhase = useCallback((next: GamePhase, duration: number, extra?: Record<string, unknown>) => {
    phaseRef.current = next;
    setPhase(next);
    setTimerDuration(duration);
    setTimerKey((k) => k + 1);
    sendToAllRef.current('PHASE_CHANGE', { phase: next, duration, ...extra });
  }, [setPhase]);

  // 페이즈 전환 로직 (호스트 전용)
  const advancePhase = useCallback(() => {
    if (!isHost) return;
    const current = phaseRef.current;
    const s = stateRef.current;

    switch (current) {
      case 'COLOR_REVEAL':
        // 색깔 공개(3s) → 색깔 선택(10s)
        transitionToPhase('COLOR_SELECTION', PHASE_DURATIONS.COLOR_SELECTION ?? 10);
        break;

      case 'COLOR_SELECTION': {
        // 색깔 선택 종료 → 라운드 결과 즉시 계산 → 시간 종료 메시지(2s)
        if (s.targetColor) {
          const result = computeRoundResult(s.currentRound, s.targetColor, s.players);
          setLastRoundResult(result);
          // 게스트에게 결과 브로드캐스트 (COMPARISON에서 바로 보여주기 위해)
          sendToAllRef.current('ROUND_RESULT', result);
        }
        transitionToPhase('TIME_UP', PHASE_DURATIONS.TIME_UP ?? 2);
        break;
      }

      case 'TIME_UP':
        // 시간 종료(2s) → 결과 비교(5s)
        transitionToPhase('COMPARISON', PHASE_DURATIONS.COMPARISON ?? 5);
        break;

      case 'COMPARISON':
        // 결과 비교(5s) → 점수 계산(3s)
        // calculateRound dispatch: state.roundResults에 반영
        calculateRound();
        transitionToPhase('SCORING', PHASE_DURATIONS.SCORING ?? 3);
        break;

      case 'SCORING':
        // 점수 표시(3s) → 다음 라운드 또는 종료
        if (s.currentRound >= s.totalRounds) {
          transitionToPhase('FINISHED', 60);
        } else {
          // 다음 라운드: 새 targetColor 생성 후 플레이어 초기화
          const nextTarget = randomRGB();
          const nextRound = s.currentRound + 1;
          syncState({ currentRound: nextRound, targetColor: nextTarget });
          startNextRound(); // 플레이어 hasSubmitted 초기화
          // 게스트에게 새 라운드 정보 포함 브로드캐스트
          phaseRef.current = 'COLOR_REVEAL';
          setPhase('COLOR_REVEAL');
          setTimerDuration(PHASE_DURATIONS.COLOR_REVEAL ?? 3);
          setTimerKey((k) => k + 1);
          sendToAllRef.current('PHASE_CHANGE', {
            phase: 'COLOR_REVEAL',
            duration: PHASE_DURATIONS.COLOR_REVEAL ?? 3,
            targetColor: nextTarget,
            currentRound: nextRound,
          });
        }
        break;

      default:
        break;
    }
  }, [isHost, transitionToPhase, calculateRound, syncState, startNextRound, setPhase]);

  // 타이머 훅: resetKey가 바뀌면 duration부터 재시작
  const { timeLeft } = useTimer({
    duration: timerDuration,
    onComplete: advancePhase,
    autoStart: true,
    resetKey: timerKey,
  });

  // 모든 플레이어가 제출하면 즉시 COLOR_SELECTION 종료 (호스트 전용)
  useEffect(() => {
    if (isHost && allSubmitted && state.phase === 'COLOR_SELECTION') {
      advancePhase();
    }
  }, [allSubmitted, isHost, state.phase, advancePhase]);

  // PeerJS 훅
  // isSinglePlayer=true이면 Peer 인스턴스 생성 자체를 건너뜀 (WebSocket 연결 에러 방지)
  const { sendToAll, connectToHost } = usePeer({
    peerId: isHost && gameId ? gameId : undefined,
    disabled: isSinglePlayer,

    onMessage: useCallback((msg: PeerMessage, _conn: DataConnection) => {
      switch (msg.type) {
        case 'COLOR_PICK': {
          // 호스트: 게스트의 픽 수신
          const { playerId, color } = msg.payload as { playerId: string; color: RGB };
          submitColorPick(playerId, color);
          break;
        }

        case 'PHASE_CHANGE': {
          // 게스트: 호스트가 알려준 페이즈로 전환
          const payload = msg.payload as {
            phase: GamePhase;
            duration: number;
            targetColor?: RGB;
            currentRound?: number;
          };
          phaseRef.current = payload.phase;
          setPhase(payload.phase);
          const dur = payload.duration ?? (PHASE_DURATIONS[payload.phase] ?? 10);
          setTimerDuration(dur);
          setTimerKey((k) => k + 1);

          // 새 라운드 시작 데이터 동기화
          if (payload.targetColor !== undefined || payload.currentRound !== undefined) {
            syncState({
              ...(payload.targetColor !== undefined ? { targetColor: payload.targetColor } : {}),
              ...(payload.currentRound !== undefined ? { currentRound: payload.currentRound } : {}),
            });
          }
          break;
        }

        case 'ROUND_RESULT': {
          // 게스트: 호스트로부터 라운드 결과 수신
          setLastRoundResult(msg.payload as RoundResult);
          break;
        }

        case 'GAME_STATE_SYNC': {
          const partial = msg.payload as Partial<typeof state>;
          syncState(partial);
          break;
        }

        default:
          break;
      }
    }, [submitColorPick, setPhase, syncState]),

    onPeerDisconnect: useCallback((peerId: string) => {
      if (!isHost && peerId === gameId) {
        alert('호스트와 연결이 끊겼습니다.');
        navigate('/');
      }
    }, [isHost, gameId, navigate]),
  });

  // sendToAll을 ref에 최신 값으로 동기화
  useEffect(() => {
    sendToAllRef.current = sendToAll;
  }, [sendToAll]);

  // 초기 설정: 플레이어 추가 + 호스트 첫 라운드 시작
  useEffect(() => {
    const gameData = gameDataRef.current;
    if (!gameData) return;

    gameData.players.forEach((p) => addPlayer(p));

    if (isHost) {
      const firstTarget = randomRGB();
      syncState({
        currentRound: 1,
        targetColor: firstTarget,
        phase: 'COLOR_REVEAL',
        phaseStartTime: Date.now(),
      });
      phaseRef.current = 'COLOR_REVEAL';
      setTimerDuration(PHASE_DURATIONS.COLOR_REVEAL ?? 3);
      setTimerKey((k) => k + 1);
    }
  // 마운트 시 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 게스트: 게임 페이지 직접 접근 시 호스트에 연결
  useEffect(() => {
    if (isHost || !gameId) return;
    const playerInfo = sessionStorage.getItem('playerInfo');
    const myId = sessionStorage.getItem('myPlayerId') ?? '';
    if (!playerInfo || !myId) return;

    connectToHost(gameId).then((conn) => {
      hostConnRef.current = conn;
      const info = JSON.parse(playerInfo) as { nickname: string; profileColor: string };
      const me: Player = {
        id: myId,
        nickname: info.nickname,
        profileColor: info.profileColor,
        score: 0,
        isHost: false,
        isReady: true,
        hasSubmitted: false,
      };
      const msg = createPeerMessage('PLAYER_JOIN', me, myId);
      conn.send(msg);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, gameId]);

  // 내 컬러 픽 제출
  const handleColorPick = useCallback((color: RGB) => {
    submitColorPick(myPlayerId, color);
    if (!isHost && hostConnRef.current?.open) {
      const msg = createPeerMessage('COLOR_PICK', { playerId: myPlayerId, color }, myPlayerId);
      hostConnRef.current.send(msg);
    }
  }, [myPlayerId, isHost, submitColorPick]);

  // 게임 종료 → 결과 페이지 이동
  useEffect(() => {
    if (state.phase === 'FINISHED') {
      sessionStorage.setItem('finalPlayers', JSON.stringify(state.players));
      sessionStorage.setItem('roundResults', JSON.stringify(state.roundResults));
      setTimeout(() => navigate(`/result/${gameId}`), 1500);
    }
  }, [state.phase, state.players, state.roundResults, gameId, navigate]);

  const phase = state.phase;
  const targetColor = state.targetColor;
  const myHasSubmitted = myPlayer?.hasSubmitted ?? false;

  // COMPARISON/SCORING에서 사용할 라운드 결과
  // state.roundResults에 이미 반영됐으면 그것 우선, 없으면 lastRoundResult 사용
  const displayRoundResult =
    state.roundResults.find((r) => r.round === state.currentRound) ?? lastRoundResult;

  // SCORING에서 누적 점수 표시: calculateRound dispatch 후 state 반영 여부로 판단
  const roundCalculated = state.roundResults.some((r) => r.round === state.currentRound);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div>
          <p className="text-gray-400 text-xs uppercase tracking-wider">라운드</p>
          <p className="text-white font-black text-2xl">
            {state.currentRound || '-'}{' '}
            <span className="text-gray-600 font-normal text-base">/ {state.totalRounds}</span>
          </p>
        </div>

        <PhaseLabel phase={phase} />

        {/* 타이머: TIME_UP, FINISHED, WAITING일 때 숨김 */}
        {phase !== 'TIME_UP' && phase !== 'FINISHED' && phase !== 'WAITING' ? (
          <Timer
            timeLeft={timeLeft}
            total={timerDuration}
            isTimeUp={false}
          />
        ) : (
          <div className="w-16 h-16" />
        )}
      </header>

      {/* 메인 게임 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 overflow-auto">

        {/* WAITING: 게스트가 호스트의 시작을 기다리는 중 */}
        {phase === 'WAITING' && (
          <div className="flex flex-col items-center gap-4 text-gray-400">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p>게임 시작을 기다리는 중...</p>
          </div>
        )}

        {/* COLOR_REVEAL: 타겟 컬러 3초 공개 */}
        {phase === 'COLOR_REVEAL' && targetColor && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-white text-xl font-bold">이 색깔을 기억하세요!</p>
            <ColorBox color={targetColor} />
          </div>
        )}

        {/* COLOR_SELECTION: 컬러 피커로 선택 */}
        {phase === 'COLOR_SELECTION' && (
          <div className="flex flex-col items-center gap-4 w-full">
            <p className="text-gray-400 text-base">방금 본 색깔을 선택하세요</p>
            <div className="w-[min(800px,90vw)] h-[min(400px,50vh)] rounded-2xl border-2 border-dashed border-gray-700 bg-gray-900/50 flex items-center justify-center">
              {myHasSubmitted ? (
                <div className="text-center">
                  <p className="text-green-400 font-bold text-xl mb-1">제출 완료!</p>
                  <p className="text-gray-500 text-sm">다른 플레이어를 기다리는 중...</p>
                </div>
              ) : (
                <p className="text-gray-600 text-sm">우측 하단 색상 피커로 선택하세요</p>
              )}
            </div>
            {/* 제출 전까지 fixed 오버레이 컬러 피커 표시 */}
            {!myHasSubmitted && (
              <ColorPicker onSubmit={handleColorPick} disabled={false} />
            )}
          </div>
        )}

        {/* TIME_UP: 시간 종료 메시지 */}
        {phase === 'TIME_UP' && (
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="bg-red-600/20 border border-red-500 text-red-400 px-16 py-8 rounded-2xl animate-bounce">
              <p className="text-5xl font-black text-center tracking-widest">시간 종료!</p>
            </div>
          </div>
        )}

        {/* COMPARISON: 결과 비교 그리드 */}
        {phase === 'COMPARISON' && targetColor && displayRoundResult && (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex items-center gap-3">
              <h2 className="text-white text-2xl font-black">
                라운드 {state.currentRound} 결과
              </h2>
              <span className="px-3 py-1 bg-indigo-600/30 border border-indigo-500 text-indigo-300 text-sm font-semibold rounded-full animate-pulse">
                분석 중...
              </span>
            </div>
            <CompareGrid
              targetColor={targetColor}
              players={state.players}
              roundResult={displayRoundResult}
              myPlayerId={myPlayerId}
            />
          </div>
        )}

        {/* COMPARISON이지만 결과가 아직 없는 경우 (네트워크 지연) */}
        {phase === 'COMPARISON' && !displayRoundResult && (
          <div className="flex flex-col items-center gap-4 text-gray-400">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">결과 데이터 수신 중...</p>
          </div>
        )}

        {/* SCORING: 점수 하이라이트 + 스코어보드 */}
        {phase === 'SCORING' && displayRoundResult && (
          <div className="flex flex-col items-center gap-6 w-full max-w-2xl">
            <h2 className="text-white text-2xl font-black">
              라운드 {state.currentRound} 점수
            </h2>

            {/* 순위별 플레이어 카드 */}
            <div className="w-full flex flex-col gap-3">
              {displayRoundResult.ranking.map((playerId, rankIndex) => {
                const player = state.players.find((p) => p.id === playerId);
                if (!player) return null;
                const highlight = RANK_HIGHLIGHTS[rankIndex];
                const earnedScore = displayRoundResult.scores[playerId] ?? 0;
                const isMe = playerId === myPlayerId;
                // 누적 점수: calculateRound가 반영됐으면 player.score 그대로, 아니면 합산
                const totalScore = roundCalculated ? player.score : player.score + earnedScore;

                return (
                  <div
                    key={playerId}
                    className={[
                      'flex items-center gap-4 p-4 rounded-2xl bg-gray-900 border border-gray-700 transition-all duration-500',
                      highlight ? highlight.glow : '',
                      isMe ? 'border-indigo-500/70' : '',
                    ].join(' ')}
                  >
                    {/* 순위 뱃지 */}
                    {highlight ? (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${highlight.badge}`}>
                        {highlight.label}
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 bg-gray-700 text-gray-400">
                        {rankIndex + 1}위
                      </div>
                    )}

                    {/* 프로필 원형 */}
                    <div
                      className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-gray-600"
                      style={{ backgroundColor: player.profileColor }}
                    />

                    {/* 닉네임 + 누적 점수 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold truncate">
                        {player.nickname}
                        {isMe && <span className="text-gray-500 text-sm font-normal ml-2">(나)</span>}
                      </p>
                      <p className="text-gray-500 text-xs">누적 {totalScore} 점</p>
                    </div>

                    {/* 이번 라운드 획득 점수 */}
                    <div className="text-right flex-shrink-0">
                      {earnedScore > 0 ? (
                        <>
                          <p className="text-yellow-400 text-2xl font-black">+{earnedScore}</p>
                          <p className="text-gray-500 text-xs">점 획득</p>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-600 text-2xl font-black">+0</p>
                          <p className="text-gray-600 text-xs">점</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* 미제출 플레이어 */}
              {state.players
                .filter((p) => !displayRoundResult.ranking.includes(p.id))
                .map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-gray-900 border border-gray-800 opacity-40"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-gray-800 text-gray-500">
                      -
                    </div>
                    <div
                      className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-gray-700"
                      style={{ backgroundColor: player.profileColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-500 font-bold">{player.nickname}</p>
                      <p className="text-gray-600 text-xs">미제출</p>
                    </div>
                  </div>
                ))}
            </div>

            {/* 전체 스코어보드 */}
            <ScoreBoard
              players={state.players}
              myPlayerId={myPlayerId}
              title="현재 총 점수"
            />
          </div>
        )}

        {/* FINISHED */}
        {phase === 'FINISHED' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-white text-3xl font-black">게임 종료!</p>
            <p className="text-gray-400">결과 페이지로 이동 중...</p>
          </div>
        )}
      </main>

      {/* 하단 플레이어 바 */}
      <footer className="border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center gap-5 justify-center flex-wrap">
          {state.players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isMe={player.id === myPlayerId}
              compact
            />
          ))}
        </div>
      </footer>
    </div>
  );
}

// 페이즈별 레이블 표시 컴포넌트
function PhaseLabel({ phase }: { phase: GamePhase }) {
  const labels: Record<GamePhase, { text: string; color: string }> = {
    WAITING:         { text: '대기 중',      color: 'text-gray-400' },
    COLOR_REVEAL:    { text: '색깔 공개',    color: 'text-blue-400' },
    COLOR_SELECTION: { text: '색깔 선택',    color: 'text-indigo-400' },
    TIME_UP:         { text: '시간 종료',    color: 'text-red-400' },
    COMPARISON:      { text: '결과 비교',    color: 'text-yellow-400' },
    SCORING:         { text: '점수 계산',    color: 'text-green-400' },
    NEXT_ROUND:      { text: '다음 라운드',  color: 'text-purple-400' },
    FINISHED:        { text: '게임 종료',    color: 'text-white' },
  };
  const { text, color } = labels[phase];
  return <span className={`font-bold text-base ${color}`}>{text}</span>;
}
