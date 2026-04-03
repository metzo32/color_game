import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Result from './pages/Result';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 루트: 홈 */}
        <Route path="/" element={<Home />} />

        {/* 로비: 방 대기실 */}
        <Route path="/lobby/:gameId" element={<Lobby />} />

        {/* 게임: 메인 게임 */}
        <Route path="/game/:gameId" element={<Game />} />

        {/* 결과: 최종 결과 */}
        <Route path="/result/:gameId" element={<Result />} />

        {/* 존재하지 않는 경로 → 홈으로 리다이렉트 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
