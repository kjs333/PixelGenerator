import { createBuffer } from './buffer';
import type { PixelBuffer } from './types';

/**
 * 정수 배율로 키운다. 픽셀 하나가 scale×scale 칸이 될 뿐 색을 섞지 않으므로 흐려지지 않는다.
 * 원본은 바꾸지 않고 새 버퍼를 돌려준다.
 */
export function scaleBuffer(src: PixelBuffer, scale: number): PixelBuffer {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new RangeError(`배율은 1 이상의 정수여야 해요: ${scale}`);
  }
  const out = createBuffer(src.width * scale, src.height * scale);
  for (let y = 0; y < out.height; y++) {
    const srcRow = Math.floor(y / scale) * src.width;
    for (let x = 0; x < out.width; x++) {
      const i = (srcRow + Math.floor(x / scale)) * 4;
      out.data.set(src.data.subarray(i, i + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}
