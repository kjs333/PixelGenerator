import { createBuffer } from './buffer';
import { fitContain } from './contain';
import type { PixelBuffer } from './types';

const ALPHA_OPAQUE_MIN = 128;
const EDGE_EPSILON = 1e-9; // 소수 계산 오차로 영역 경계가 한 칸 밀리는 것을 막는다

/**
 * 원본을 목표 크기로 줄인다. 목표 픽셀 하나 = 원본 영역의 평균색.
 * 브라우저 drawImage는 축소 결과가 브라우저마다 달라서 직접 계산한다.
 * 비율이 다르면 자르지 않고, 가운데에 맞춰 넣은 뒤 남는 부분은 투명 여백으로 둔다.
 */
export function downscale(src: PixelBuffer, width: number, height: number): PixelBuffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`목표 크기는 1 이상의 정수여야 해요: ${width}x${height}`);
  }

  const { ox, oy, cw, ch } = fitContain(src.width, src.height, width, height);
  const out = createBuffer(width, height); // 처음엔 전부 투명 = 여백
  for (let ly = 0; ly < ch; ly++) {
    const y0 = Math.min(src.height - 1, Math.floor((ly * src.height) / ch + EDGE_EPSILON));
    const y1 = Math.min(src.height, Math.max(y0 + 1, Math.ceil(((ly + 1) * src.height) / ch - EDGE_EPSILON)));
    for (let lx = 0; lx < cw; lx++) {
      const x0 = Math.min(src.width - 1, Math.floor((lx * src.width) / cw + EDGE_EPSILON));
      const x1 = Math.min(src.width, Math.max(x0 + 1, Math.ceil(((lx + 1) * src.width) / cw - EDGE_EPSILON)));
      writeAverage(src, out, ox + lx, oy + ly, x0, x1, y0, y1);
    }
  }
  return out;
}

/** 영역의 평균색을 구해 out의 (tx, ty)에 쓴다. 투명 픽셀은 색 평균에서 뺀다. */
function writeAverage(
  src: PixelBuffer,
  out: PixelBuffer,
  tx: number,
  ty: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): void {
  let sumA = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * src.width + x) * 4;
      const a = src.data[i + 3]!;
      sumA += a;
      sumR += src.data[i]! * a;
      sumG += src.data[i + 1]! * a;
      sumB += src.data[i + 2]! * a;
    }
  }
  const count = (x1 - x0) * (y1 - y0);
  if (sumA === 0 || sumA / count < ALPHA_OPAQUE_MIN) return; // 완전 투명으로 둔다(기본값 0)

  const o = (ty * out.width + tx) * 4;
  out.data[o] = Math.round(sumR / sumA);
  out.data[o + 1] = Math.round(sumG / sumA);
  out.data[o + 2] = Math.round(sumB / sumA);
  out.data[o + 3] = 255;
}
