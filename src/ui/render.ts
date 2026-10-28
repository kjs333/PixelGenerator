import type { PixelBuffer } from '../core/types';

/** PixelBuffer를 캔버스에 그린다. 캔버스 크기는 버퍼 크기에 맞춘다. */
export function drawBuffer(canvas: HTMLCanvasElement, buf: PixelBuffer): void {
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.width, buf.height), 0, 0);
}

/** 캔버스 전체를 PixelBuffer로 읽는다. */
export function readBuffer(canvas: HTMLCanvasElement): PixelBuffer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 읽을 수 없어요');
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) };
}
