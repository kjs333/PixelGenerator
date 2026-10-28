import { CLEANUP_MAX_LUMA_DIFF } from '../config/constants';
import { cloneBuffer } from './buffer';
import { colorDistanceSq, luminance } from './color';
import type { PixelBuffer, RGBA } from './types';

const ALPHA_OPAQUE_MIN = 128;
const ORTHOGONAL = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

/**
 * 외톨이 칸 정리(픽셀 아트 8원칙의 Pixel Clusters).
 * 상하좌우 이웃 중 같은 색이 하나도 없는 칸을, 주변 8칸에서 가장 많은 색으로 바꾼다.
 * 눈동자처럼 의도한 점이 지워지지 않도록 밝기 차이가 클 때는 그대로 둔다.
 * 판단은 항상 원본 기준이라 칸을 훑는 순서에 영향받지 않는다.
 */
export function cleanupOrphans(img: PixelBuffer): PixelBuffer {
  const out = cloneBuffer(img);
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < img.width && y < img.height;
  const colorAt = (x: number, y: number): RGBA | null => {
    if (!inBounds(x, y)) return null;
    const i = (y * img.width + x) * 4;
    if (img.data[i + 3]! < ALPHA_OPAQUE_MIN) return null;
    return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, 255];
  };
  const same = (a: RGBA, b: RGBA) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const c = colorAt(x, y);
      if (!c) continue;

      const near = ORTHOGONAL.map(([dx, dy]) => colorAt(x + dx!, y + dy!)).filter((n): n is RGBA => n !== null);
      if (near.length < 3 || near.some((n) => same(n, c))) continue;

      const majority = mostCommon(
        AROUND.map(([dx, dy]) => colorAt(x + dx!, y + dy!)).filter((n): n is RGBA => n !== null),
        c,
      );
      if (!majority || Math.abs(luminance(c) - luminance(majority)) > CLEANUP_MAX_LUMA_DIFF) continue;
      out.data.set(majority, (y * img.width + x) * 4);
    }
  }
  return out;
}

/** 가장 많은 색. 개수가 같으면 기준 색(target)에 가까운 색. */
function mostCommon(colors: RGBA[], target: RGBA): RGBA | null {
  const counts = new Map<string, { color: RGBA; count: number }>();
  for (const c of colors) {
    const key = c.join(',');
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { color: c, count: 1 });
  }
  const best = [...counts.values()].sort(
    (a, b) =>
      b.count - a.count ||
      colorDistanceSq(a.color, target) - colorDistanceSq(b.color, target) ||
      a.color[0] - b.color[0] ||
      a.color[1] - b.color[1] ||
      a.color[2] - b.color[2],
  )[0];
  return best ? best.color : null;
}
