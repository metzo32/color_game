import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import type { DataConnection } from 'peerjs';
import type { Player, PeerMessage, GameState } from '../types/game';
import { usePeer } from '../hooks/usePeer';
import PlayerCard from '../components/PlayerCard';
import { generateInviteLink, copyToClipboard, createPeerMessage } from '../utils/peerUtils';

// sessionStorage에서 플레이어 정보 불러오기
function loadPlayerInfo(): { nickname: string; profileColor: string } | null {
  const raw = sessionStorage.getItem('playerInfo');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { nickname: string; profileColor: string };
  } catch {
    return null;
  }
}

export default function Lobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isHost = searchParams.get('host') === 'true';

  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string>(isHost ? 'Peer 초기화 중...' : '호스트 연결 중...');
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [peerError, setPeerError] = useState<string | null>(null);
  const hostConnRef = useRef<DataConnection | null>(null);

  // sendToAll을 ref로 관리하여 onMessage 콜백 내 순환 의존성 방지
  const sendToAllRef = useRef<(type: PeerMessage['type'], payload: unknown) => void>(() => { });

  const playerInfo = loadPlayerInfo();
  const inviteLink = gameId ? generateInviteLink(gameId) : '';

  // 전체 플레이어 목록을 모든 게스트에게 브로드캐스트 (호스트 전용)
  const broadcastPlayers = useCallback((playerList: Player[]) => {
    sendToAllRef.current('GAME_STATE_SYNC', { players: playerList });
  }, []);

  const { myPeerId, isReady, connections, connectToHost, sendToAll, sendTo: _sendTo } = usePeer({
    // 호스트는 gameId를 자신의 Peer ID로 사용
    peerId: isHost && gameId ? gameId : undefined,

    onMessage: useCallback((msg: PeerMessage, _conn: DataConnection) => {
      switch (msg.type) {
        case 'PLAYER_JOIN': {
          const newPlayer = msg.payload as Player;
          setPlayers((prev) => {
            if (prev.find((p) => p.id === newPlayer.id)) return prev;
            const updated = [...prev, newPlayer];
            // 호스트: 업데이트된 전체 목록 브로드캐스트 (ref 사용으로 stale closure 방지)
            if (isHost) {
              setTimeout(() => broadcastPlayers(updated), 0);
            }
            return updated;
          });
          break;
        }
        case 'GAME_STATE_SYNC': {
          // 게스트: 호스트로부터 전체 상태 동기화
          const state = msg.payload as Partial<GameState>;
          if (state.players) setPlayers(state.players);
          break;
        }
        case 'GAME_START': {
          // 게임 시작 신호 수신 → 게임 페이지로 이동
          navigate(`/game/${gameId}`);
          break;
        }
        case 'PLAYER_LEAVE': {
          const playerId = msg.payload as string;
          setPlayers((prev) => prev.filter((p) => p.id !== playerId));
          break;
        }
        default:
          break;
      }
    }, [isHost, gameId, navigate, broadcastPlayers]),

    onPeerConnect: useCallback((_conn: DataConnection) => {
      setStatus('플레이어 연결됨');
    }, []),

    onPeerDisconnect: useCallback((peerId: string) => {
      setPlayers((prev) => prev.filter((p) => p.id !== peerId));
    }, []),

    onError: useCallback((err: Error) => {
      setPeerError(`연결 오류: ${err.message}`);
    }, []),
  });

  // sendToAll을 ref에 최신 값으로 동기화
  useEffect(() => {
    sendToAllRef.current = sendToAll;
  }, [sendToAll]);

  // 호스트: PeerJS 연결 전에 gameId로 즉시 플레이어 등록
  // 호스트의 peer ID는 항상 gameId로 고정되므로 PeerJS가 준비될 때까지 기다릴 필요 없음
  useEffect(() => {
    if (!isHost || !playerInfo || !gameId) return;
    const hostId = gameId;
    setMyPlayerId(hostId);
    sessionStorage.setItem('myPlayerId', hostId);
    const me: Player = {
      id: hostId,
      nickname: playerInfo.nickname,
      profileColor: playerInfo.profileColor,
      score: 0,
      isHost: true,
      isReady: false,
      hasSubmitted: false,
    };
    setPlayers([me]);
    setStatus('대기 중 - 플레이어를 기다리는 중...');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, gameId]);

  // 게스트: PeerJS 준비 후 호스트에 연결
  useEffect(() => {
    if (isHost || !myPeerId || !playerInfo || !gameId) return;
    setMyPlayerId(myPeerId);
    sessionStorage.setItem('myPlayerId', myPeerId);
    const me: Player = {
      id: myPeerId,
      nickname: playerInfo.nickname,
      profileColor: playerInfo.profileColor,
      score: 0,
      isHost: false,
      isReady: false,
      hasSubmitted: false,
    };
    connectToHost(gameId)
      .then((conn) => {
        hostConnRef.current = conn;
        setStatus('호스트 연결 완료');
        const msg = createPeerMessage('PLAYER_JOIN', me, myPeerId);
        conn.send(msg);
        setPlayers((prev) => {
          if (prev.find((p) => p.id === me.id)) return prev;
          return [...prev, me];
        });
      })
      .catch(() => {
        setPeerError('호스트에 연결할 수 없습니다. 초대 링크를 확인해주세요.');
      });
  // 마운트 시 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPeerId, isHost, gameId]);

  // 게임 시작 (호스트 전용)
  const handleStartGame = useCallback(() => {
    if (players.length < 1) return;
    // sessionStorage에 플레이어 목록 저장 (게임 페이지에서 불러오기 위해)
    sessionStorage.setItem('gamePlayers', JSON.stringify(players));
    sessionStorage.setItem('myPlayerId', myPlayerId ?? '');
    // 게스트들에게 게임 시작 알림
    sendToAllRef.current('GAME_START', { gameId });
    navigate(`/game/${gameId}`);
  }, [players, gameId, navigate, myPlayerId]);

  // 초대 링크 복사
  const handleCopyLink = useCallback(async () => {
    const success = await copyToClipboard(inviteLink);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [inviteLink]);

  // Peer ID와 커넥션 수 정보
  const guestCount = connections.length;

  if (!playerInfo) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg mb-4">플레이어 정보가 없습니다.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 게스트만 PeerJS 준비를 기다림 (호스트는 gameId로 즉시 시작)
  if (!isReady && !isHost) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {/* 방 ID */}
          {/* <p className="text-gray-600 text-xs font-mono">방 ID: {gameId}</p> */}

          {/* 스피너 */}
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-gray-800" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          </div>

          {/* 텍스트 */}
          <div className="text-center flex flex-col gap-2">
            <p className="text-white font-bold text-lg">게임 시작을 기다리는 중...</p>
            <p className="text-gray-500 text-sm">
              {isHost ? 'Peer 서버에 연결하는 중입니다' : '호스트에 연결하는 중입니다'}
            </p>
          </div>

          {/* shimmer 로딩바 */}
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-indigo-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgb(99,102,241) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          </div>

          {/* 에러 표시 */}
          {peerError && (
            <div className="w-full bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
              {peerError}
            </div>
          )}

          {/* 나가기 */}
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-400 text-sm transition-colors"
          >
            나가기
          </button>
        </div>

        {/* shimmer 키프레임 — Tailwind에 없는 커스텀 애니메이션이므로 style 태그로 주입 */}
        <style>{`
          @keyframes shimmer {
            0%   { background-position: 200% center; }
            100% { background-position: -200% center; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg flex flex-col gap-6">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-3xl font-black text-white mb-1">대기실</h1>
          {/* <p className="text-gray-500 text-sm font-mono">방 ID: {gameId}</p> */}
        </div>

        {/* 연결 상태 */}
        <div className={`text-center text-sm py-2 px-4 rounded-xl ${peerError ? 'bg-red-900/30 text-red-400 border border-red-700' : 'bg-gray-800/60 text-gray-400'}`}>
          {peerError ?? status}
          {!peerError && !isReady && (
            <span className="ml-2 inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          )}
          {!peerError && isReady && (
            <span className="ml-2 inline-block w-2 h-2 bg-green-400 rounded-full" />
          )}
        </div>

        {/* 초대 링크 */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-gray-400 text-sm font-medium">초대 링크</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 text-sm font-mono focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${copied
                  ? 'bg-green-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
            >
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
          <p className="text-gray-600 text-xs">이 링크를 친구들에게 공유하세요. (최대 8명)</p>
        </div>

        {/* 플레이어 목록 */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-gray-300 font-semibold text-sm">
              참가자 <span className="text-indigo-400">{players.length}</span> / 8
            </p>
            {isHost && guestCount > 0 && (
              <p className="text-green-400 text-xs">{guestCount}명 연결됨</p>
            )}
          </div>

          {players.length === 0 ? (
            <div className="py-8 text-center text-gray-600 text-sm">
              {isReady ? '참가자를 기다리는 중...' : '연결 중...'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isMe={player.id === myPlayerId}
                />
              ))}
            </div>
          )}
        </div>

        {/* 게임 시작 버튼 (호스트 전용) */}
        {isHost ? (
          <button
            onClick={handleStartGame}
            disabled={players.length < 1}
            className={`
              w-full py-4 rounded-2xl font-black text-lg transition-all
              ${players.length >= 1
                ? 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-900/40'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }
            `}
          >
            {players.length >= 1 ? '게임 시작!' : '플레이어가 필요합니다'}
          </button>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            호스트가 게임을 시작할 때까지 기다려주세요...
          </div>
        )}

        {/* 뒤로가기 */}
        <button
          onClick={() => navigate('/')}
          className="text-gray-600 hover:text-gray-400 text-sm text-center transition-colors"
        >
          나가기
        </button>
      </div>
    </div>
  );
}
