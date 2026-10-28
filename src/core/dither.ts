import { createBuffer } from './buffer';
import { nearestIndex } from './color';
import type { DitherMode, PixelBuffer, RGBA } from './types';

const ALPHA_OPAQUE_MIN = 128;
const BAYER_STRENGTH = 64; // 값이 클수록 무늬가 거칠어진다

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** 이미지의 모든 불투명 픽셀을 팔레트 색으로 바꾼다. 투명 픽셀은 투명으로 남긴다. */
export function dither(src: PixelBuffer, palette: readonly RGBA[], mode: DitherMode): PixelBuffer {
  if (palette.length === 0) throw new Error('팔레트가 비어 있어요');
  switch (mode) {
    case 'none':
      return mapPixels(src, palette, () => 0);
    case 'bayer':
      return mapPixels(src, palette, (x, y) => {
        const threshold = (BAYER_4X4[y % 4]![x % 4]! + 0.5) / 16 - 0.5;
        return threshold * BAYER_STRENGTH;
      });
    case 'floyd-steinberg':
      return floydSteinberg(src, palette);
  }
}

const clamp = (v: number) => Math.max(0, Math.min(255, v));

/** 픽셀마다 offset(x, y)을 더한 색에 가장 가까운 팔레트 색을 쓴다. */
function mapPixels(
  src: PixelBuffer,
  palette: readonly RGBA[],
  offset: (x: number, y: number) => number,
): PixelBuffer {
  const out = createBuffer(src.width, src.height);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (src.data[i + 3]! < ALPHA_OPAQUE_MIN) continue;
      const d = offset(x, y);
      const adjusted: RGBA = [
        clamp(src.data[i]! + d),
        clamp(src.data[i + 1]! + d),
        clamp(src.data[i + 2]! + d),
        255,
      ];
      out.data.set(palette[nearestIndex(palette, adjusted)]!, i);
    }
  }
  return out;
}

/** 오차를 오른쪽·아래 이웃에 나눠 주는 방식. 투명 픽셀로는 오차를 보내지 않는다. */
function floydSteinberg(src: PixelBuffer, palette: readonly RGBA[]): PixelBuffer {
  const { width, height } = src;
  const out = createBuffer(width, height);
  const work = new Float32Array(width * height * 3);
  for (let p = 0; p < width * height; p++) {
    work[p * 3] = src.data[p * 4]!;
    work[p * 3 + 1] = src.data[p * 4 + 1]!;
    work[p * 3 + 2] = src.data[p * 4 + 2]!;
  }
  const isOpaque = (x: number, y: number) =>
    x >= 0 && x < width && y < height && src.data[(y * width + x) * 4 + 3]! >= ALPHA_OPAQUE_MIN;

  const spread = (x: number, y: number, weight: number, err: readonly number[]) => {
    if (!isOpaque(x, y)) return;
    const w = (y * width + x) * 3;
    for (let c = 0; c < 3; c++) work[w + c] = work[w + c]! + err[c]! * weight;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isOpaque(x, y)) continue;
      const w = (y * width + x) * 3;
      const wanted: RGBA = [clamp(work[w]!), clamp(work[w + 1]!), clamp(work[w + 2]!), 255];
      const chosen = palette[nearestIndex(palette, wanted)]!;
      out.data.set(chosen, (y * width + x) * 4);

      const err = [wanted[0] - chosen[0], wanted[1] - chosen[1], wanted[2] - chosen[2]];
      spread(x + 1, y, 7 / 16, err);
      spread(x - 1, y + 1, 3 / 16, err);
      spread(x, y + 1, 5 / 16, err);
      spread(x + 1, y + 1, 1 / 16, err);
    }
  }
  return out;
}
