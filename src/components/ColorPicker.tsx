import { useState, useCallback, useRef, useEffect } from 'react';
import type { RGB } from '../types/game';
import { rgbToHex } from '../utils/colorUtils';

// ─────────────────────────────────────────────
// HSV ↔ RGB 변환 유틸 (컴포넌트 내부 전용)
// ─────────────────────────────────────────────

interface HSV {
  h: number; // 0 ~ 360
  s: number; // 0 ~ 1
  v: number; // 0 ~ 1
}

/** HSV → RGB 변환 */
function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** RGB → HSV 변환 (초기값 설정에 사용) */
function rgbToHsv({ r, g, b }: RGB): HSV {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rr)      h = 60 * (((gg - bb) / delta) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / delta + 2);
    else                 h = 60 * ((rr - gg) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

/** 순수 Hue 색상(채도·명도 최대)을 CSS rgb 문자열로 반환 */
function hueToRgbString(h: number): string {
  const { r, g, b } = hsvToRgb({ h, s: 1, v: 1 });
  return `rgb(${r},${g},${b})`;
}

// ─────────────────────────────────────────────
// 팔레트 크기 상수
// ─────────────────────────────────────────────
const PALETTE_W = 280;
const PALETTE_H = 200;
const HUE_BAR_H = 20;

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface ColorPickerProps {
  onSubmit?: (color: RGB) => void;
  onChange?: (color: RGB) => void;
  hideSubmit?: boolean;
  disabled?: boolean;
  initialColor?: RGB;
}

export default function ColorPicker({
  onSubmit,
  onChange,
  hideSubmit = false,
  disabled = false,
  initialColor = { r: 128, g: 128, b: 128 },
}: ColorPickerProps) {
  // 내부 상태: HSV 모델로 관리
  const initHsv = rgbToHsv(initialColor);
  const [hsv, setHsv] = useState<HSV>(initHsv);
  const [submitted, setSubmitted] = useState(false);

  // 현재 RGB (렌더마다 HSV에서 계산)
  const color: RGB = hsvToRgb(hsv);
  const hexCode = rgbToHex(color);

  // hsv 변경 시 부모에게 실시간 알림
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onChangeRef.current?.(color); }, [hsv]); // eslint-disable-line react-hooks/exhaustive-deps

  // 팔레트 캔버스 ref
  const paletteRef = useRef<HTMLCanvasElement>(null);
  // 드래그 상태 추적
  const isDraggingPalette = useRef(false);
  const isDraggingHue = useRef(false);

  // ─── 팔레트 캔버스 그리기 ───────────────────
  const drawPalette = useCallback(() => {
    const canvas = paletteRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1) 선택된 Hue의 순수 색상으로 채우기
    ctx.fillStyle = hueToRgbString(hsv.h);
    ctx.fillRect(0, 0, PALETTE_W, PALETTE_H);

    // 2) 가로: 왼쪽(흰) → 오른쪽(투명) 그라디언트 오버레이
    const whiteGrad = ctx.createLinearGradient(0, 0, PALETTE_W, 0);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, PALETTE_W, PALETTE_H);

    // 3) 세로: 위(투명) → 아래(검정) 그라디언트 오버레이
    const blackGrad = ctx.createLinearGradient(0, 0, 0, PALETTE_H);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, PALETTE_W, PALETTE_H);
  }, [hsv.h]);

  // Hue 변경 혹은 마운트 시 팔레트 재렌더
  useEffect(() => {
    drawPalette();
  }, [drawPalette]);

  // ─── 팔레트 좌표 → S/V 값 계산 ─────────────
  const applyPaletteCoord = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = paletteRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.min(Math.max(clientX - rect.left, 0), PALETTE_W);
      const y = Math.min(Math.max(clientY - rect.top, 0), PALETTE_H);
      const s = x / PALETTE_W;
      const v = 1 - y / PALETTE_H;
      setHsv((prev) => ({ ...prev, s, v }));
    },
    []
  );

  // ─── 팔레트 이벤트 핸들러 ───────────────────
  const handlePaletteMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || submitted) return;
      isDraggingPalette.current = true;
      applyPaletteCoord(e.clientX, e.clientY);
    },
    [disabled, submitted, applyPaletteCoord]
  );

  const handlePaletteMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingPalette.current) return;
      applyPaletteCoord(e.clientX, e.clientY);
    },
    [applyPaletteCoord]
  );

  const handlePaletteMouseUp = useCallback(() => {
    isDraggingPalette.current = false;
  }, []);

  // 팔레트 터치 이벤트
  const handlePaletteTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || submitted) return;
      isDraggingPalette.current = true;
      const t = e.touches[0];
      applyPaletteCoord(t.clientX, t.clientY);
    },
    [disabled, submitted, applyPaletteCoord]
  );

  const handlePaletteTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingPalette.current) return;
      e.preventDefault();
      const t = e.touches[0];
      applyPaletteCoord(t.clientX, t.clientY);
    },
    [applyPaletteCoord]
  );

  const handlePaletteTouchEnd = useCallback(() => {
    isDraggingPalette.current = false;
  }, []);

  // ─── Hue 바 좌표 → H 값 계산 ────────────────
  const hueBarRef = useRef<HTMLDivElement>(null);

  const applyHueCoord = useCallback((clientX: number) => {
    const bar = hueBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const h = (x / rect.width) * 360;
    setHsv((prev) => ({ ...prev, h }));
  }, []);

  const handleHueMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled || submitted) return;
      isDraggingHue.current = true;
      applyHueCoord(e.clientX);
    },
    [disabled, submitted, applyHueCoord]
  );

  const handleHueMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingHue.current) return;
      applyHueCoord(e.clientX);
    },
    [applyHueCoord]
  );

  const handleHueMouseUp = useCallback(() => {
    isDraggingHue.current = false;
  }, []);

  // Hue 바 터치 이벤트
  const handleHueTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || submitted) return;
      isDraggingHue.current = true;
      applyHueCoord(e.touches[0].clientX);
    },
    [disabled, submitted, applyHueCoord]
  );

  const handleHueTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingHue.current) return;
      e.preventDefault();
      applyHueCoord(e.touches[0].clientX);
    },
    [applyHueCoord]
  );

  const handleHueTouchEnd = useCallback(() => {
    isDraggingHue.current = false;
  }, []);

  // 드래그가 캔버스 밖으로 나가도 mouseup 감지
  useEffect(() => {
    const onUp = () => {
      isDraggingPalette.current = false;
      isDraggingHue.current = false;
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  // ─── 제출 핸들러 ────────────────────────────
  const handleSubmit = useCallback(() => {
    if (disabled || submitted) return;
    setSubmitted(true);
    onSubmit?.(color);
  }, [color, disabled, submitted, onSubmit]);

  // 팔레트 위 커서 원의 위치 (픽셀)
  const cursorX = hsv.s * PALETTE_W;
  const cursorY = (1 - hsv.v) * PALETTE_H;

  // Hue 슬라이더 썸 위치 (%)
  const hueThumbLeft = (hsv.h / 360) * 100;

  return (
    // 고정 위치 오버레이: 화면 우측 하단에 배치
    <div className="fixed bottom-6 right-6 z-50" style={{ width: 308 }}>
      <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">

        {/* ── 2D 그라디언트 팔레트 ── */}
        <div
          className="relative select-none"
          style={{ width: PALETTE_W, height: PALETTE_H }}
          // 팔레트 영역 밖으로 mousemove 도달하도록 여기서도 처리
          onMouseMove={handlePaletteMouseMove}
          onMouseUp={handlePaletteMouseUp}
        >
          <canvas
            ref={paletteRef}
            width={PALETTE_W}
            height={PALETTE_H}
            className={`rounded-lg block ${disabled || submitted ? 'opacity-50' : 'cursor-crosshair'}`}
            onMouseDown={handlePaletteMouseDown}
            onTouchStart={handlePaletteTouchStart}
            onTouchMove={handlePaletteTouchMove}
            onTouchEnd={handlePaletteTouchEnd}
          />

          {/* 선택 위치 커서 원 */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: cursorX,
              top: cursorY,
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2.5px solid #ffffff',
              boxShadow: '0 0 0 1.5px rgba(0,0,0,0.6)',
            }}
          />
        </div>

        {/* ── Hue 슬라이더 바 ── */}
        <div
          ref={hueBarRef}
          className={`relative rounded-full select-none ${disabled || submitted ? 'opacity-50' : 'cursor-pointer'}`}
          style={{
            width: PALETTE_W,
            height: HUE_BAR_H,
            background:
              'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
          onMouseDown={handleHueMouseDown}
          onMouseMove={handleHueMouseMove}
          onMouseUp={handleHueMouseUp}
          onTouchStart={handleHueTouchStart}
          onTouchMove={handleHueTouchMove}
          onTouchEnd={handleHueTouchEnd}
        >
          {/* Hue 슬라이더 썸 */}
          <div
            className="absolute top-1/2 pointer-events-none"
            style={{
              left: `${hueThumbLeft}%`,
              transform: 'translate(-50%, -50%)',
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: '2.5px solid #ffffff',
              boxShadow: '0 0 0 1.5px rgba(0,0,0,0.6)',
              backgroundColor: hueToRgbString(hsv.h),
            }}
          />
        </div>

        {/* ── 컬러 미리보기 + HEX 코드 ── */}
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 rounded-lg border border-gray-600 shadow-inner"
            style={{
              width: 48,
              height: 48,
              backgroundColor: `rgb(${color.r},${color.g},${color.b})`,
            }}
          />
          <div className="flex flex-col gap-0.5">
            <p className="text-white font-bold text-base font-mono tracking-wider">
              {hexCode.toUpperCase()}
            </p>
            <p className="text-gray-400 text-xs font-mono">
              {`rgb(${color.r}, ${color.g}, ${color.b})`}
            </p>
          </div>
        </div>

        {/* ── 제출 버튼 (hideSubmit=false일 때만 표시) ── */}
        {!hideSubmit && (
          <button
            onClick={handleSubmit}
            disabled={disabled || submitted}
            className={`
              w-full py-3 rounded-xl font-bold text-base transition-all duration-200
              ${submitted
                ? 'bg-green-600 text-white cursor-not-allowed'
                : disabled
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-lg shadow-indigo-900/40'
              }
            `}
          >
            {submitted ? '제출 완료!' : '컬러 선택 확정'}
          </button>
        )}

      </div>
    </div>
  );
}
