import type { PixelBuffer, RGBA } from '../src/core/types';

/** 픽셀 목록(왼쪽 위부터 가로 방향)으로 버퍼를 만든다. */
export function fromPixels(width: number, height: number, pixels: RGBA[]): PixelBuffer {
  if (pixels.length !== width * height) {
    throw new Error(`pixels.length(${pixels.length}) != ${width}x${height}`);
  }
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach((p, i) => data.set(p, i * 4));
  return { width, height, data };
}

export function solid(width: number, height: number, color: RGBA): PixelBuffer {
  return fromPixels(width, height, Array.from({ length: width * height }, () => color));
}

/** 왼쪽에서 오른쪽으로 검정 → 흰색으로 변하는 이미지. 열마다 다른 회색을 가진다. */
export function grayGradient(width: number, height: number): PixelBuffer {
  const pixels: RGBA[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.round((x / Math.max(1, width - 1)) * 255);
      pixels.push([v, v, v, 255]);
    }
  }
  return fromPixels(width, height, pixels);
}

/** 사진과 비슷하게 색이 많이 섞인 이미지(결정적). */
export function colorfulGradient(width: number, height: number): PixelBuffer {
  const pixels: RGBA[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.push([
        Math.round((x / Math.max(1, width - 1)) * 255),
        Math.round((y / Math.max(1, height - 1)) * 255),
        Math.round(((x + y) / Math.max(1, width + height - 2)) * 255),
        255,
      ]);
    }
  }
  return fromPixels(width, height, pixels);
}

export function pixelAt(buf: PixelBuffer, x: number, y: number): RGBA {
  const i = (y * buf.width + x) * 4;
  return [buf.data[i]!, buf.data[i + 1]!, buf.data[i + 2]!, buf.data[i + 3]!];
}

export function key(c: RGBA): string {
  return c.join(',');
}
