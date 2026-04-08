import type { Player, RGB, RoundResult } from '../types/game';
import { rgbToHex, rgbToString, rgbDistance } from '../utils/colorUtils';

interface CompareGridProps {
  targetColor: RGB;
  players: Player[];
  roundResult: RoundResult;
  myPlayerId: string;
}

// 순위별 강조 스타일
const RANK_HIGHLIGHTS: Record<number, { border: string; badge: string; label: string }> = {
  0: { border: 'border-4 border-yellow-400', badge: 'bg-yellow-400 text-gray-900', label: '1위' },
  1: { border: 'border-4 border-gray-300', badge: 'bg-gray-300 text-gray-900', label: '2위' },
  2: { border: 'border-2 border-orange-400', badge: 'bg-orange-400 text-white', label: '3위' },
};

export default function CompareGrid({
  targetColor,
  players,
  roundResult,
  myPlayerId,
}: CompareGridProps) {
  const { ranking, picks } = roundResult;

  // 랭킹 순서로 플레이어 정렬
  const sortedPlayers = ranking
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as Player[];

  // 미제출 플레이어도 포함
  const submittedIds = new Set(ranking);
  const notSubmitted = players.filter((p) => !submittedIds.has(p.id));

  const allPlayersOrdered = [...sortedPlayers, ...notSubmitted];
  const colCount = allPlayersOrdered.length;

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="grid gap-3 min-w-max mx-auto"
        style={{ gridTemplateColumns: `repeat(${colCount + 1}, minmax(120px, 1fr))` }}
      >
        {/* 헤더 행: 타겟 + 플레이어 컬럼 라벨 */}
        {/* 타겟 컬럼 헤더 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-indigo-400 font-bold text-sm uppercase tracking-wider h-[34px]">문제</span>
          {/* 타겟 컬러 박스 */}
          <div
            className="w-full aspect-square rounded-xl shadow-lg border-2 border-indigo-500 flex items-start justify-center pt-2"
            style={{ backgroundColor: rgbToString(targetColor) }}
          >
            <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1">
              <p className="text-white text-xs font-mono">{rgbToHex(targetColor)}</p>
            </div>
          </div>
        </div>

        {/* 각 플레이어 컬럼 */}
        {allPlayersOrdered.map((player, index) => {
          const rankIndex = ranking.indexOf(player.id);
          const highlight = rankIndex >= 0 && rankIndex <= 2 ? RANK_HIGHLIGHTS[rankIndex] : null;
          const pick = picks[player.id];
          const distance = pick ? rgbDistance(targetColor, pick) : null;
          const earnedScore = roundResult.scores[player.id] ?? 0;
          const isMe = player.id === myPlayerId;

          return (
            <div key={player.id} className="flex flex-col items-center gap-2">
              {/* 플레이어 정보 헤더 */}
              <div className="flex flex-col items-center">
                {/* {highlight && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${highlight.badge}`}>
                    {highlight.label}
                  </span>
                )} */}
                <div
                  className={`w-5 h-5 rounded-full border-2 ${isMe ? 'border-white' : 'border-gray-600'}`}
                  style={{ backgroundColor: player.profileColor }}
                />
                <p className={`text-xs font-medium truncate max-w-[100px] ${isMe ? 'text-white' : 'text-gray-300'}`}>
                  {player.nickname}
                  {/* {isMe && ' (나)'} */}
                </p>
                {/* {earnedScore > 0 && (
                  <span className="text-yellow-400 text-xs font-bold">+{earnedScore}점</span>
                )} */}
              </div>

              {/* 플레이어 선택 컬러 박스 */}
              {pick ? (
                <div
                  className={`w-full aspect-square rounded-xl shadow-md flex justify-center items-start pt-2 ${highlight ? highlight.border : ''}`}
                  style={{ backgroundColor: rgbToString(pick) }}
                >
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 text-center">
                    <p className="text-white text-xs font-mono">{rgbToHex(pick)}</p>
                    {distance !== null && (
                      <p className="text-gray-300 text-xs">거리: {distance.toFixed(1)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-square rounded-xl bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center">
                  <p className="text-gray-500 text-xs">미제출</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
