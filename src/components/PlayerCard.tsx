import type { Player } from '../types/game';

interface PlayerCardProps {
  player: Player;
  isMe?: boolean;
  showScore?: boolean;
  rank?: number;        // 최종 랭킹에서 순위 표시
  compact?: boolean;    // 게임 중 하단 바에서 컴팩트하게 표시
}

// 순위별 스타일
const RANK_STYLES: Record<number, { border: string; badge: string; glow: string }> = {
  1: {
    border: 'border-yellow-400',
    badge: 'bg-yellow-400 text-gray-900',
    glow: 'shadow-yellow-400/40 shadow-lg',
  },
  2: {
    border: 'border-gray-300',
    badge: 'bg-gray-300 text-gray-900',
    glow: 'shadow-gray-300/30 shadow-md',
  },
  3: {
    border: 'border-orange-400',
    badge: 'bg-orange-400 text-white',
    glow: 'shadow-orange-400/30 shadow-md',
  },
};

export default function PlayerCard({
  player,
  isMe = false,
  showScore = false,
  rank,
  compact = false,
}: PlayerCardProps) {
  const rankStyle = rank ? RANK_STYLES[rank] : null;

  if (compact) {
    // 게임 중 하단에 표시되는 컴팩트 카드
    return (
      <div className={`flex flex-col items-center gap-1 ${isMe ? 'opacity-100' : 'opacity-80'}`}>
        {/* 프로필 원형 아바타 */}
        <div
          className={`
            w-10 h-10 rounded-full border-2 flex-shrink-0 transition-all
            ${isMe ? 'border-white scale-110' : 'border-gray-600'}
            ${player.hasSubmitted ? 'ring-2 ring-green-400' : ''}
          `}
          style={{ backgroundColor: player.profileColor }}
          title={player.nickname}
        />
        {/* 닉네임 */}
        <p className={`text-xs truncate max-w-[60px] text-center ${isMe ? 'text-white font-bold' : 'text-gray-300'}`}>
          {player.nickname}
          {isMe && ' (나)'}
        </p>
        {/* 제출 여부 표시 */}
        {player.hasSubmitted && (
          <span className="text-xs text-green-400">완료</span>
        )}
      </div>
    );
  }

  // 풀사이즈 카드 (로비 등)
  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-xl border transition-all
        ${rankStyle ? `${rankStyle.border} border-2 ${rankStyle.glow}` : 'border-gray-700'}
        ${isMe ? 'bg-gray-700/60' : 'bg-gray-800/60'}
      `}
    >
      {/* 순위 뱃지 */}
      {rank && (
        <span
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${rankStyle?.badge ?? ''}`}
        >
          {rank}
        </span>
      )}

      {/* 프로필 아바타 */}
      <div
        className="w-10 h-10 rounded-full flex-shrink-0 border-2 border-gray-600"
        style={{ backgroundColor: player.profileColor }}
      />

      {/* 닉네임 + 호스트 뱃지 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-semibold truncate ${isMe ? 'text-white' : 'text-gray-200'}`}>
            {player.nickname}
            {isMe && <span className="text-gray-400 text-sm ml-1">(나)</span>}
          </p>
          {player.isHost && (
            <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full flex-shrink-0">
              호스트
            </span>
          )}
        </div>
      </div>

      {/* 점수 */}
      {showScore && (
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-indigo-400">{player.score}</p>
          <p className="text-xs text-gray-500">점</p>
        </div>
      )}
    </div>
  );
}
