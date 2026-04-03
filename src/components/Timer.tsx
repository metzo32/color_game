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
    <div className="flex flex-col items-center gap-1">
      {label && <p className="text-gray-400 text-sm">{label}</p>}
      <div className="relative w-16 h-16">
        {/* SVG 원형 타이머 */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
          {/* 배경 원 */}
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth="4"
          />
          {/* 진행 원 */}
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke={isUrgent ? '#ef4444' : '#6366f1'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        {/* 숫자 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-lg font-black tabular-nums ${
              isUrgent ? 'text-red-400 animate-pulse' : 'text-white'
            }`}
          >
            {timeLeft}
          </span>
        </div>
      </div>
    </div>
  );
}
