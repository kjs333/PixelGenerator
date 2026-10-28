export interface FitResult {
  width: number;
  height: number;
  scaled: boolean;
}

/** 긴 변이 max를 넘으면 비율을 지키며 줄인다. */
export function scaleToFit(width: number, height: number, max: number): FitResult {
  if (width <= max && height <= max) return { width, height, scaled: false };
  const ratio = max / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}
