import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface RequireSessionProps {
  children: React.ReactNode;
}

/**
 * 새로고침(페이지 하드 리로드) 감지 후 루트(/)로 리다이렉트하는 가드 컴포넌트.
 *
 * 동작 원리:
 * - 정상 진입 경로: navigate() 호출 직전에 sessionStorage.setItem('navigating', 'true') 세팅
 * - 이 컴포넌트가 마운트될 때 해당 플래그가 없으면 → 새로고침으로 판단 → 전체 clear 후 / 리다이렉트
 * - 플래그가 있으면 → 정상 진입 → 플래그 제거 후 렌더링 계속
 */
export default function RequireSession({ children }: RequireSessionProps) {
  const navigate = useNavigate();
  // 리다이렉트 여부를 ref로 관리하여 렌더링 중 상태 변경 없이 처리
  const shouldRedirect = useRef(false);

  // 마운트 시 1회만 실행: 플래그 유무 확인
  useEffect(() => {
    const flag = sessionStorage.getItem('navigating');

    if (!flag) {
      // 플래그 없음 → 새로고침으로 판단
      shouldRedirect.current = true;
      sessionStorage.clear();
      navigate('/', { replace: true });
    } else {
      // 플래그 있음 → 정상 진입, 플래그 제거
      sessionStorage.removeItem('navigating');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 리다이렉트 대기 중이면 아무것도 렌더링하지 않음
  if (shouldRedirect.current) return null;

  return <>{children}</>;
}
