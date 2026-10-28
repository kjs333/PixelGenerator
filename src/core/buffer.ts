import type { PixelBuffer, RGBA } from './types';

function assertSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`크기는 1 이상의 정수여야 해요: ${width}x${height}`);
  }
}

function indexOf(buf: PixelBuffer, x: number, y: number): number {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= buf.width || y >= buf.height) {
    throw new RangeError(`좌표가 범위 밖이에요: (${x}, ${y})`);
  }
  return (y * buf.width + x) * 4;
}

export function createBuffer(width: number, height: number): PixelBuffer {
  assertSize(width, height);
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function cloneBuffer(buf: PixelBuffer): PixelBuffer {
  return { width: buf.width, height: buf.height, data: new Uint8ClampedArray(buf.data) };
}

export function getPixel(buf: PixelBuffer, x: number, y: number): RGBA {
  const i = indexOf(buf, x, y);
  return [buf.data[i]!, buf.data[i + 1]!, buf.data[i + 2]!, buf.data[i + 3]!];
}

export function setPixel(buf: PixelBuffer, x: number, y: number, color: RGBA): void {
  buf.data.set(color, indexOf(buf, x, y));
}
