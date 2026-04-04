import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateRoomId } from '../utils/peerUtils';

// 프리셋 프로필 컬러 6가지
const PRESET_COLORS = [
  '#ef4444', // 빨강
  '#f97316', // 주황
  '#eab308', // 노랑
  '#22c55e', // 초록
  '#3b82f6', // 파랑
  '#a855f7', // 보라
];

type Mode = 'idle' | 'solo' | 'multi' | 'create' | 'join';

interface FormState {
  nickname: string;
  profileColor: string;
  inviteCode: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('idle');
  const [form, setForm] = useState<FormState>({
    nickname: '',
    profileColor: PRESET_COLORS[0],
    inviteCode: '',
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});

  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode);
    setErrors({});
  }, []);

  // 유효성 검사
  const validate = (): boolean => {
    const newErrors: Partial<FormState> = {};
    if (!form.nickname.trim()) {
      newErrors.nickname = '닉네임을 입력해주세요.';
    } else if (form.nickname.trim().length > 12) {
      newErrors.nickname = '닉네임은 12자 이하로 입력해주세요.';
    }
    if (mode === 'join' && !form.inviteCode.trim()) {
      newErrors.inviteCode = '초대 코드를 입력해주세요.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSoloPlay = useCallback(() => {
    if (!validate()) return;

    const playerId = crypto.randomUUID();
    const gameId = generateRoomId();
    const playerInfo = {
      nickname: form.nickname.trim(),
      profileColor: form.profileColor,
    };

    // 싱글 플레이 데이터 저장
    sessionStorage.setItem('playerInfo', JSON.stringify(playerInfo));
    sessionStorage.setItem('myPlayerId', playerId);
    sessionStorage.setItem('gamePlayers', JSON.stringify([
      {
        id: playerId,
        nickname: playerInfo.nickname,
        profileColor: playerInfo.profileColor,
        score: 0,
        isHost: true,
        isReady: true,
        hasSubmitted: false,
      },
    ]));

    navigate(`/game/${gameId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, navigate]);

  const handlePlay = useCallback(() => {
    if (!validate()) return;

    // 플레이어 정보를 sessionStorage에 임시 저장
    const playerInfo = {
      nickname: form.nickname.trim(),
      profileColor: form.profileColor,
    };
    sessionStorage.setItem('playerInfo', JSON.stringify(playerInfo));

    if (mode === 'create') {
      // 새 방 ID 생성 후 로비로 이동
      const roomId = generateRoomId();
      navigate(`/lobby/${roomId}?host=true`);
    } else if (mode === 'join') {
      // 초대 코드에서 방 ID 추출
      let roomId = form.inviteCode.trim();
      // 초대 링크 전체가 입력된 경우 ID만 추출
      if (roomId.includes('/lobby/')) {
        roomId = roomId.split('/lobby/')[1].split('?')[0];
      } else if (roomId.includes('/game/')) {
        roomId = roomId.split('/game/')[1].split('?')[0];
      }
      navigate(`/lobby/${roomId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, mode, navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      {/* 배경 그라디언트 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-8">
        {/* 타이틀 */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight">
            색깔 맻추기
          </h1>
          <p className="text-gray-400 text-base">
            미대 출신 개발자가 만든 색감 테스트 게임 - 너희의 눈을 시험하러 왔다
          </p>
        </div>

        {/* 게임 모드 선택 (최초) */}
        {mode === 'idle' && (
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => handleModeChange('solo')}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-indigo-900/40"
            >
              혼자하기
            </button>
            <button
              onClick={() => handleModeChange('multi')}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 active:scale-95 text-white font-bold text-lg rounded-2xl transition-all border border-gray-700"
            >
              함께하기
            </button>
          </div>
        )}

        {/* 함께하기 모드 선택 */}
        {mode === 'multi' && (
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => handleModeChange('create')}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-indigo-900/40"
            >
              게임 만들기
            </button>
            <button
              onClick={() => handleModeChange('join')}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 active:scale-95 text-white font-bold text-lg rounded-2xl transition-all border border-gray-700"
            >
              게임 참여하기
            </button>
            <button
              onClick={() => handleModeChange('idle')}
              className="w-full py-4 bg-gray-900 hover:bg-gray-800 active:scale-95 text-gray-300 font-bold text-lg rounded-2xl transition-all border border-gray-700"
            >
              뒤로
            </button>
          </div>
        )}

        {/* 폼 영역 */}
        {(mode === 'solo' || mode === 'create' || mode === 'join') && (
          <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
            {/* 폼 헤더 */}
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">
                {mode === 'solo' ? '혼자하기' : (mode === 'create' ? '게임 만들기' : '게임 참여하기')}
              </h2>
              <button
                onClick={() => handleModeChange(mode === 'solo' ? 'idle' : 'multi')}
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                취소
              </button>
            </div>

            {/* 닉네임 입력 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-gray-300 text-sm font-medium">
                닉네임 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="닉네임 입력 (최대 12자)"
                value={form.nickname}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, nickname: e.target.value }));
                  setErrors((prev) => ({ ...prev, nickname: undefined }));
                }}
                maxLength={12}
                className={`
                  w-full bg-gray-800 border rounded-xl px-4 py-3 text-white placeholder-gray-600
                  focus:outline-none focus:ring-2 transition-all
                  ${errors.nickname ? 'border-red-500 focus:ring-red-500/30' : 'border-gray-700 focus:ring-indigo-500/30 focus:border-indigo-500'}
                `}
              />
              {errors.nickname && (
                <p className="text-red-400 text-xs">{errors.nickname}</p>
              )}
            </div>

            {/* 프로필 컬러 선택 */}
            <div className="flex flex-col gap-2">
              <label className="text-gray-300 text-sm font-medium">
                프로필 컬러 <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm((prev) => ({ ...prev, profileColor: color }))}
                    className={`
                      w-10 h-10 rounded-full transition-all duration-200
                      ${form.profileColor === color
                        ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                        : 'hover:scale-110'
                      }
                    `}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* 초대 코드 (참여하기 전용) */}
            {mode === 'join' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-300 text-sm font-medium">
                  초대 코드 또는 링크 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="초대 코드 또는 링크 붙여넣기"
                  value={form.inviteCode}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, inviteCode: e.target.value }));
                    setErrors((prev) => ({ ...prev, inviteCode: undefined }));
                  }}
                  className={`
                    w-full bg-gray-800 border rounded-xl px-4 py-3 text-white placeholder-gray-600
                    focus:outline-none focus:ring-2 transition-all
                    ${errors.inviteCode ? 'border-red-500 focus:ring-red-500/30' : 'border-gray-700 focus:ring-indigo-500/30 focus:border-indigo-500'}
                  `}
                />
                {errors.inviteCode && (
                  <p className="text-red-400 text-xs">{errors.inviteCode}</p>
                )}
              </div>
            )}

            {/* 플레이 버튼 */}
            <button
              onClick={mode === 'solo' ? handleSoloPlay : handlePlay}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-base rounded-xl transition-all shadow-lg shadow-indigo-900/40 mt-1"
            >
              {mode === 'solo' ? '게임 시작' : (mode === 'create' ? '방 만들기' : '참여하기')}
            </button>
          </div>
        )}

        {/* 게임 설명 */}
        {/* <div className="text-center text-gray-600 text-xs space-y-1">
          <p>최대 8명 플레이 | 8라운드 | 초대 링크로만 참여</p>
          <p>1위 2점 · 2위 1점 | RGB 유클리드 거리로 순위 결정</p>
        </div> */}
      </div>
    </div>
  );
}
