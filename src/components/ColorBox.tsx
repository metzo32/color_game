import type { RGB } from '../types/game';
import { rgbToHex, rgbToString, getContrastColor } from '../utils/colorUtils';

interface ColorBoxProps {
  color: RGB;
  showCode?: boolean;   // 컬러 코드 표시 여부
  label?: string;       // 박스 위에 표시할 레이블
  size?: 'full' | 'sm'; // full: 800x800, sm: 컴팩트
}

export default function ColorBox({ color, showCode = false, label, size = 'full' }: ColorBoxProps) {
  const bgColor = rgbToString(color);
  const textColor = getContrastColor(color);
  const hexCode = rgbToHex(color);

  if (size === 'sm') {
    return (
      <div className="flex flex-col items-center gap-1">
        {label && (
          <p className="text-xs text-gray-400 font-medium truncate max-w-[120px] text-center">{label}</p>
        )}
        <div
          className="w-full aspect-square rounded-lg shadow-md"
          style={{ backgroundColor: bgColor }}
        />
        {showCode && (
          <div className="text-center">
            <p className="text-xs font-mono text-gray-300">{hexCode}</p>
            <p className="text-xs font-mono text-gray-500">{bgColor}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {label && (
        <h2 className="text-xl font-bold text-white">{label}</h2>
      )}
      <div
        className="w-[min(800px,90vw)] h-[min(800px,90vw)] max-h-[60vh] rounded-2xl shadow-2xl flex items-end justify-center pb-6 transition-all duration-500"
        style={{ backgroundColor: bgColor }}
      >
        {showCode && (
          <div
            className="px-4 py-2 rounded-xl backdrop-blur-sm"
            style={{
              backgroundColor: `${textColor === '#ffffff' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'}`,
            }}
          >
            <p className="font-mono font-bold text-lg" style={{ color: textColor }}>
              {hexCode}
            </p>
            <p className="font-mono text-sm" style={{ color: textColor }}>
              {bgColor}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
