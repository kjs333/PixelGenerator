import { ANIMATION_MAX_SIZE, PIXEL_ART_MAX_COLORS } from '../config/constants';
import { createBuffer } from './buffer';
import type { PixelBuffer } from './types';

export type PixelArtFailure = 'too-large' | 'too-many-colors';

export type PixelArtCheck =
  | { ok: true; image: PixelBuffer; scale: number }
  | { ok: false; reason: PixelArtFailure };

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** 두 칸이 같은 색인지. 완전히 투명한 칸끼리는 RGB가 달라도 같다고 본다. */
function samePixel(data: Uint8ClampedArray, i: number, j: number): boolean {
  if (data[i + 3] === 0 && data[j + 3] === 0) return true;
  return data[i] === data[j] && data[i + 1] === data[j + 1] && data[i + 2] === data[j + 2] && data[i + 3] === data[j + 3];
}

/**
 * 정수 배로 키운 픽셀 그림이면 그 배율을, 아니면 1을 돌려준다.
 * 모든 줄·열에서 같은 색이 이어지는 길이의 최대공약수를 구한다.
 * 길이가 모두 k의 배수이면 줄마다 k칸씩, 열마다 k칸씩 같은 색이므로 k×k 칸이 한 색이다.
 */
export function detectScale(buf: PixelBuffer): number {
  const { width, height, data } = buf;
  let k = gcd(width, height);
  for (let y = 0; y < height && k > 1; y++) {
    let run = 1;
    for (let x = 1; x < width; x++) {
      const i = (y * width + x) * 4;
      if (samePixel(data, i, i - 4)) run++;
      else {
        k = gcd(k, run);
        run = 1;
      }
    }
  }
  for (let x = 0; x < width && k > 1; x++) {
    let run = 1;
    for (let y = 1; y < height; y++) {
      const i = (y * width + x) * 4;
      if (samePixel(data, i, i - width * 4)) run++;
      else {
        k = gcd(k, run);
        run = 1;
      }
    }
  }
  return k;
}

/** k×k 칸마다 왼쪽 위 칸의 색을 가져와 1/k로 줄인다. */
function shrink(buf: PixelBuffer, k: number): PixelBuffer {
  if (k === 1) return buf;
  const out = createBuffer(buf.width / k, buf.height / k);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const i = (y * k * buf.width + x * k) * 4;
      out.data.set(buf.data.subarray(i, i + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

function countColors(buf: PixelBuffer, limit: number): number {
  const seen = new Set<number>();
  const view = new DataView(buf.data.buffer, buf.data.byteOffset, buf.data.byteLength);
  for (let i = 0; i < buf.data.length; i += 4) {
    // RGBA를 숫자 하나로 센다. 완전히 투명한 칸은 모두 0으로 세어 한 색이 된다.
    seen.add(buf.data[i + 3] === 0 ? 0 : view.getUint32(i));
    if (seen.size > limit) break;
  }
  return seen.size;
}

/**
 * 애니메이션 첫 프레임으로 쓸 수 있는 픽셀 그림인지 확인한다.
 * 정수 배 확대본은 원래 크기로 줄인 뒤, Pixellab 크기 제한과 색 수를 본다.
 * 사진이나 부드럽게 그린 그림은 흐린 중간색 때문에 색 수에서 걸러진다.
 */
export function checkPixelArt(buf: PixelBuffer): PixelArtCheck {
  const scale = detectScale(buf);
  const image = shrink(buf, scale);
  if (image.width > ANIMATION_MAX_SIZE || image.height > ANIMATION_MAX_SIZE) {
    return { ok: false, reason: 'too-large' };
  }
  if (countColors(image, PIXEL_ART_MAX_COLORS) > PIXEL_ART_MAX_COLORS) {
    return { ok: false, reason: 'too-many-colors' };
  }
  return { ok: true, image, scale };
}
