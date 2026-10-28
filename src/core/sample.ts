import { createBuffer } from './buffer';
import type { PixelBuffer } from './types';

/**
 * 픽셀 수가 maxPixels를 넘으면 일정 간격으로 건너뛰며 뽑아 줄인다.
 * 색을 섞지 않으므로 뽑힌 색은 모두 원본에 실제로 있는 색이다(팔레트 만들 때 쓴다).
 */
export function sampleNearest(src: PixelBuffer, maxPixels: number): PixelBuffer {
  if (!Number.isInteger(maxPixels) || maxPixels < 1) {
    throw new RangeError(`표본 상한은 1 이상의 정수여야 해요: ${maxPixels}`);
  }
  if (src.width * src.height <= maxPixels) return src;

  let step = Math.ceil(Math.sqrt((src.width * src.height) / maxPixels));
  const count = (s: number) => Math.ceil(src.width / s) * Math.ceil(src.height / s);
  while (count(step) > maxPixels) step++;

  const width = Math.ceil(src.width / step);
  const height = Math.ceil(src.height / step);
  const out = createBuffer(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * step * src.width + x * step) * 4;
      out.data.set(src.data.subarray(i, i + 4), (y * width + x) * 4);
    }
  }
  return out;
}
