import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Player, RoundResult } from '../types/game';
import { rgbToHex } from '../utils/colorUtils';
import { generateRoomId } from '../utils/peerUtils';

// 순위별 스타일
const RANK_STYLES = [
  { bg: 'bg-yellow-500/10 border-yellow-500/40', text: 'text-yellow-400', badge: 'bg-yellow-400 text-gray-900', icon: '1st' },
  { bg: 'bg-gray-400/10 border-gray-400/40', text: 'text-gray-300', badge: 'bg-gray-300 text-gray-900', icon: '2nd' },
  { bg: 'bg-orange-500/10 border-orange-500/40', text: 'text-orange-400', badge: 'bg-orange-400 text-white', icon: '3rd' },
];

function loadResults(): { players: Player[]; roundResults: RoundResult[] } | null {
  try {
    const playersRaw = sessionStorage.getItem('finalPlayers');
    const resultsRaw = sessionStorage.getItem('roundResults');
    if (!playersRaw || !resultsRaw) return null;
    return {
      players: JSON.parse(playersRaw) as Player[],
      roundResults: JSON.parse(resultsRaw) as RoundResult[],
    };
  } catch {
    return null;
  }
}

export default function Result() {
  useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [myPlayerId] = useState(() => sessionStorage.getItem('myPlayerId') ?? '');
  const [data] = useState(loadResults);
  const [voted, setVoted] = useState<'again' | 'leave' | null>(null);

  // 데이터 없으면 홈으로
  useEffect(() => {
    if (!data) {
      navigate('/');
    }
  }, [data, navigate]);

  if (!data) return null;

  const { players, roundResults } = data;

  // 점수 내림차순 정렬
  const ranked = [...players].sort((a, b) => b.score - a.score);

  const handlePlayAgain = () => {
    setVoted('again');
    // 새 게임은 새 roomId 생성 (이전 PeerJS 연결과 충돌 방지)
    const newGameId = generateRoomId();
    // 플레이어 정보 초기화 (점수만 리셋)
    const resetPlayers = players.map((p) => ({ ...p, score: 0, hasSubmitted: false, currentPick: undefined }));
    sessionStorage.setItem('gamePlayers', JSON.stringify(resetPlayers));
    setTimeout(() => navigate(`/lobby/${newGameId}?host=true`), 500);
  };

  const handleLeave = () => {
    setVoted('leave');
    sessionStorage.clear();
    setTimeout(() => navigate('/'), 300);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-4xl font-black text-white mb-2">게임 종료!</h1>
          <p className="text-gray-500">Color Match 최종 결과</p>
        </div>

        {/* 최종 랭킹 */}
        <div className="flex flex-col gap-3">
          {ranked.map((player, index) => {
            const style = RANK_STYLES[index] ?? {
              bg: 'bg-gray-800/40 border-gray-700',
              text: 'text-gray-400',
              badge: 'bg-gray-700 text-gray-300',
              icon: `${index + 1}th`,
            };
            const isMe = player.id === myPlayerId;

            return (
              <div
                key={player.id}
                className={`
                  flex items-center gap-4 p-4 rounded-2xl border transition-all
                  ${style.bg}
                  ${isMe ? 'ring-2 ring-indigo-500/50' : ''}
                `}
              >
                {/* 순위 뱃지 */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${style.badge}`}>
                  {style.icon}
                </div>

                {/* 프로필 아바타 */}
                <div
                  className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-gray-600"
                  style={{ backgroundColor: player.profileColor }}
                />

                {/* 닉네임 */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-lg ${isMe ? 'text-white' : 'text-gray-200'}`}>
                    {player.nickname}
                    {isMe && <span className="text-gray-500 text-sm font-normal ml-2">(나)</span>}
                    {player.isHost && (
                      <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">호스트</span>
                    )}
                  </p>
                </div>

                {/* 총 점수 */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-3xl font-black ${style.text}`}>{player.score}</p>
                  <p className="text-gray-600 text-xs">점</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 라운드별 요약 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <h3 className="text-gray-400 text-sm font-semibold mb-3 uppercase tracking-wider">라운드 요약</h3>
          <div className="flex flex-col gap-2">
            {roundResults.map((result) => {
              const winner = players.find((p) => p.id === result.ranking[0]);
              return (
                <div key={result.round} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                  <span className="text-gray-600 text-sm w-16 flex-shrink-0">Round {result.round}</span>
                  <div
                    className="w-6 h-6 rounded flex-shrink-0"
                    style={{ backgroundColor: `rgb(${result.targetColor.r},${result.targetColor.g},${result.targetColor.b})` }}
                    title={rgbToHex(result.targetColor)}
                  />
                  <span className="text-gray-500 text-xs font-mono">{rgbToHex(result.targetColor)}</span>
                  <span className="flex-1" />
                  {winner && (
                    <div className="flex items-center gap-1">
                      <div
                        className="w-5 h-5 rounded-full"
                        style={{ backgroundColor: winner.profileColor }}
                      />
                      <span className="text-yellow-400 text-xs font-bold">{winner.nickname}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={handlePlayAgain}
            disabled={voted !== null}
            className={`
              flex-1 py-4 rounded-2xl font-bold text-base transition-all
              ${voted === 'again'
                ? 'bg-green-600 text-white'
                : voted !== null
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-900/40'
              }
            `}
          >
            {voted === 'again' ? '잠시 후 이동...' : '다시하기'}
          </button>
          <button
            onClick={handleLeave}
            disabled={voted !== null}
            className={`
              flex-1 py-4 rounded-2xl font-bold text-base transition-all
              ${voted === 'leave'
                ? 'bg-gray-600 text-white'
                : voted !== null
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-gray-800 hover:bg-gray-700 active:scale-95 text-white border border-gray-700'
              }
            `}
          >
            {voted === 'leave' ? '잠시 후 이동...' : '나가기'}
          </button>
        </div>
      </div>
    </div>
  );
}
