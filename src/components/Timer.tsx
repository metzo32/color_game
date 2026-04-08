interface TimerProps {
  timeLeft: number;
  total: number;
  isTimeUp?: boolean;
  label?: string;
}

export default function Timer({ timeLeft, total, isTimeUp = false, label }: TimerProps) {
  const progress = timeLeft / total; // 1 → 0
  const isUrgent = timeLeft <= 3 && timeLeft > 0;

  // 원형 progress bar 계산
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  if (isTimeUp) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 animate-bounce">
        <div className="bg-red-600/90 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-red-900/50">
          <p className="text-2xl font-black tracking-widest">시간 종료!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {label && <p className="text-gray-400 text-sm">{label}</p>}
      <span
        className={`text-2xl font-black tabular-nums ${
          isUrgent ? 'text-red-400 animate-pulse' : 'text-gray-300'
        }`}
      >
        {timeLeft}s
      </span>
    </div>
  );
}
