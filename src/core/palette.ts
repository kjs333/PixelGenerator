import { luminance } from './color';
import type { PixelBuffer, RGBA } from './types';

const ALPHA_OPAQUE_MIN = 128;

/** 이미지에 실제로 쓰인 서로 다른 불투명 색 목록. 어두운 색 → 밝은 색 순서. */
export function extractPalette(img: PixelBuffer): RGBA[] {
  const found = new Map<number, RGBA>();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3]! < ALPHA_OPAQUE_MIN) continue;
    const r = img.data[i]!;
    const g = img.data[i + 1]!;
    const b = img.data[i + 2]!;
    const key = (r << 16) | (g << 8) | b;
    if (!found.has(key)) found.set(key, [r, g, b, 255]);
  }
  return [...found.values()].sort(
    (a, b) => luminance(a) - luminance(b) || a[0] - b[0] || a[1] - b[1] || a[2] - b[2],
  );
}
