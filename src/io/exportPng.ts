import { scaleBuffer } from '../core/scale';
import type { PixelBuffer } from '../core/types';

const REVOKE_DELAY_MS = 1000; // 다운로드가 시작되기 전에 주소를 없애지 않도록 잠시 둔다

const assertPositiveInt = (name: string, value: number) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name}은(는) 1 이상의 정수여야 해요: ${value}`);
  }
};

/**
 * 저장 파일 이름. 사용자 입력은 쓰지 않고 크기·배율·날짜 숫자로만 만든다.
 * 예: pixel-32x32-x4-20261028-150102.png
 */
export function exportFileName(width: number, height: number, scale: number, date: Date = new Date()): string {
  assertPositiveInt('가로', width);
  assertPositiveInt('세로', height);
  assertPositiveInt('배율', scale);
  const two = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`;
  const time = `${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
  return `pixel-${width}x${height}-x${scale}-${day}-${time}.png`;
}

/**
 * 픽셀 결과를 PNG 파일로 내려받는다. 배율 1이 원래 해상도다.
 * 투명 픽셀은 파일에서도 투명으로 저장된다.
 */
export async function savePixelPng(image: PixelBuffer, scale: number): Promise<void> {
  const scaled = scaleBuffer(image, scale);
  const canvas = document.createElement('canvas');
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 쓸 수 없어요');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(scaled.data), scaled.width, scaled.height), 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG로 바꾸지 못했어요'))), 'image/png');
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(image.width, image.height, scale);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
