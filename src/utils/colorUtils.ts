import type { RGB } from '../types/game';

// 0~255 사이의 랜덤 정수 생성
function randomChannel(): number {
  return Math.floor(Math.random() * 256);
}

// 랜덤 RGB 컬러 생성
export function randomRGB(): RGB {
  return {
    r: randomChannel(),
    g: randomChannel(),
    b: randomChannel(),
  };
}

// 두 RGB 컬러 간의 유클리드 거리 계산
export function rgbDistance(a: RGB, b: RGB): number {
  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
    Math.pow(a.g - b.g, 2) +
    Math.pow(a.b - b.b, 2)
  );
}

// RGB → 16진수 문자열 변환 (예: "#1a2b3c")
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

// 16진수 문자열 → RGB 변환
export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

// RGB → CSS rgb() 문자열 변환 (예: "rgb(26, 43, 60)")
export function rgbToString(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

// 배경색에 따라 텍스트 색상을 흰색 또는 검정으로 결정
export function getContrastColor(rgb: RGB): string {
  // 밝기(luminance) 계산 공식
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// 점수 결과 계산: 1위 2점, 2위 1점
export function calculateRoundScores(
  targetColor: RGB,
  picks: Record<string, RGB>
): { scores: Record<string, number>; ranking: string[] } {
  // 각 플레이어의 거리를 계산
  const distances = Object.entries(picks).map(([playerId, color]) => ({
    playerId,
    distance: rgbDistance(targetColor, color),
  }));

  // 거리 기준 오름차순 정렬 (가까울수록 앞)
  distances.sort((a, b) => a.distance - b.distance);

  const scores: Record<string, number> = {};
  const ranking = distances.map((d) => d.playerId);

  // 초기화
  ranking.forEach((id) => (scores[id] = 0));

  // 1위 2점, 2위 1점 부여
  if (ranking.length >= 1) scores[ranking[0]] = 2;
  if (ranking.length >= 2) scores[ranking[1]] = 1;

  return { scores, ranking };
}
