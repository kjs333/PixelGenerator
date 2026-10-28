import type { RGBA } from './types';

/** 두 색의 RGB 차이 제곱합. 알파는 보지 않는다. */
export function colorDistanceSq(a: RGBA, b: RGBA): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/** 가장 가까운 팔레트 색의 번호. 거리가 같으면 앞쪽 번호. */
export function nearestIndex(palette: readonly RGBA[], color: RGBA): number {
  if (palette.length === 0) throw new Error('팔레트가 비어 있어요');
  let best = 0;
  let bestDist = Infinity;
  palette.forEach((c, i) => {
    const d = colorDistanceSq(c, color);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

/** 사람 눈의 밝기 느낌에 가까운 값(0~255). */
export function luminance(c: RGBA): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}
