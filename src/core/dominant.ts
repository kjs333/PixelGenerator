import { createBuffer } from './buffer';
import { nearestIndex } from './color';
import { fitContain } from './contain';
import type { PixelBuffer, RGBA } from './types';

const ALPHA_OPAQUE_MIN = 128;
const SAMPLES_PER_AXIS = 8; // 칸 하나당 8×8개 지점을 본다

/**
 * 원본을 목표 크기로 줄이되, 각 칸에는 평균색이 아니라 **그 칸에서 가장 많이 나온 팔레트 색**을 쓴다.
 * 경계에서 색이 섞여 흐려지지 않아서 픽셀 아트처럼 또렷하게 남는다.
 * 투명한 지점이 절반 이상인 칸은 투명으로 둔다. 비율이 다르면 자르지 않고 투명 여백을 넣는다.
 */
export function dominantDownscale(
  src: PixelBuffer,
  width: number,
  height: number,
  palette: readonly RGBA[],
): PixelBuffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`목표 크기는 1 이상의 정수여야 해요: ${width}x${height}`);
  }
  if (palette.length === 0) throw new Error('팔레트가 비어 있어요');

  const { ox, oy, cw, ch } = fitContain(src.width, src.height, width, height);
  const out = createBuffer(width, height); // 처음엔 전부 투명 = 여백
  const total = SAMPLES_PER_AXIS * SAMPLES_PER_AXIS;

  for (let ly = 0; ly < ch; ly++) {
    for (let lx = 0; lx < cw; lx++) {
      const counts = new Array<number>(palette.length).fill(0);
      let transparent = 0;
      for (let sy = 0; sy < SAMPLES_PER_AXIS; sy++) {
        const y = Math.min(src.height - 1, Math.floor(((ly + (sy + 0.5) / SAMPLES_PER_AXIS) * src.height) / ch));
        for (let sx = 0; sx < SAMPLES_PER_AXIS; sx++) {
          const x = Math.min(src.width - 1, Math.floor(((lx + (sx + 0.5) / SAMPLES_PER_AXIS) * src.width) / cw));
          const i = (y * src.width + x) * 4;
          if (src.data[i + 3]! < ALPHA_OPAQUE_MIN) {
            transparent++;
            continue;
          }
          counts[nearestIndex(palette, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, 255])]!++;
        }
      }
      if (transparent * 2 >= total) continue; // 투명 칸: 기본값(0) 그대로

      let best = 0;
      counts.forEach((count, index) => {
        if (count > counts[best]!) best = index; // 개수가 같으면 앞쪽 색
      });
      out.data.set(palette[best]!, ((oy + ly) * width + (ox + lx)) * 4);
    }
  }
  return out;
}
