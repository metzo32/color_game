import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTimerOptions {
  duration: number;      // 초 단위
  onComplete?: () => void;
  autoStart?: boolean;
  // resetKey가 바뀌면 타이머를 duration부터 새로 시작
  resetKey?: number;
}

interface UseTimerReturn {
  timeLeft: number;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  progress: number; // 0~1 (1 = 시작, 0 = 끝)
}

export function useTimer({
  duration,
  onComplete,
  autoStart = false,
  resetKey,
}: UseTimerOptions): UseTimerReturn {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(autoStart);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  // duration을 ref로도 보관 — interval 내부에서 최신값 참조
  const durationRef = useRef(duration);

  // 콜백 최신 참조 유지
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // interval 정리 헬퍼
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setTimeLeft(durationRef.current);
  }, [clearTimer]);

  // resetKey 또는 duration이 바뀌면 타이머를 처음부터 다시 시작
  // 핵심 수정: isRunning을 false로 먼저 내린 뒤 autoStart 값으로 세팅
  // → isRunning effect가 false→true 전환을 인식하여 interval을 새로 생성
  useEffect(() => {
    clearTimer();
    setTimeLeft(duration);
    // 먼저 false로 강제 전환하여 isRunning effect를 반드시 재실행
    setIsRunning(false);
    if (autoStart) {
      // 다음 microtask에서 true로 전환 — React batching으로 인해
      // 같은 flush에 false→true가 묶이더라도 두 값이 다르므로 effect 재실행 보장
      // queueMicrotask 대신 setTimeout(0)으로 안전하게 처리
      const id = setTimeout(() => setIsRunning(true), 0);
      return () => clearTimeout(id);
    }
  // duration과 resetKey가 바뀔 때만 실행 (autoStart는 의도적으로 제외)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, duration]);

  // isRunning이 true가 되면 interval 생성, false가 되면 정리
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setIsRunning(false);
          // state 업데이트 완료 후 onComplete 호출
          setTimeout(() => onCompleteRef.current?.(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  return {
    timeLeft,
    isRunning,
    start,
    stop,
    reset,
    progress: duration > 0 ? timeLeft / duration : 0,
  };
}
