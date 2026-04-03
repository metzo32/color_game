import type { Player } from '../types/game';
import PlayerCard from './PlayerCard';

interface ScoreBoardProps {
  players: Player[];
  myPlayerId: string;
  title?: string;
}

export default function ScoreBoard({ players, myPlayerId, title = '점수판' }: ScoreBoardProps) {
  // 점수 내림차순 정렬
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-4 w-full max-w-sm">
      <h3 className="text-white font-bold text-center mb-3 text-sm uppercase tracking-wider">
        {title}
      </h3>
      <div className="flex flex-col gap-2">
        {sorted.map((player, index) => (
          <PlayerCard
            key={player.id}
            player={player}
            isMe={player.id === myPlayerId}
            showScore
            rank={index + 1}
          />
        ))}
      </div>
    </div>
  );
}
