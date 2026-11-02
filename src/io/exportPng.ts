import { SHEET_COLUMNS } from '../config/constants';
import { buildSheet } from '../core/spritesheet';
import { scaleBuffer } from '../core/scale';
import type { PixelBuffer } from '../core/types';
import { createZip } from './zip';

const REVOKE_DELAY_MS = 1000; // 다운로드가 시작되기 전에 주소를 없애지 않도록 잠시 둔다

const assertPositiveInt = (name: string, value: number) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name}은(는) 1 이상의 정수여야 해요: ${value}`);
  }
};

/** 파일 이름 끝에 붙이는 날짜·시각. 예: 20261028-150102 */
function timeStamp(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`;
  const time = `${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
  return `${day}-${time}`;
}

/**
 * 저장 파일 이름. 사용자 입력은 쓰지 않고 크기·배율·날짜 숫자로만 만든다.
 * 예: pixel-32x32-x4-20261028-150102.png
 */
export function exportFileName(width: number, height: number, scale: number, date: Date = new Date()): string {
  assertPositiveInt('가로', width);
  assertPositiveInt('세로', height);
  assertPositiveInt('배율', scale);
  return `pixel-${width}x${height}-x${scale}-${timeStamp(date)}.png`;
}

/**
 * 애니메이션 저장 파일 이름. 프레임 한 칸의 크기와 프레임 수를 넣는다.
 * 예: sheet-32x32-8f-20261028-150102.png, frames-32x32-8f-20261028-150102.zip
 */
export function animationFileName(
  kind: 'sheet' | 'frames',
  frameWidth: number,
  frameHeight: number,
  count: number,
  date: Date = new Date(),
): string {
  assertPositiveInt('가로', frameWidth);
  assertPositiveInt('세로', frameHeight);
  assertPositiveInt('프레임 수', count);
  const ext = kind === 'sheet' ? 'png' : 'zip';
  return `${kind}-${frameWidth}x${frameHeight}-${count}f-${timeStamp(date)}.${ext}`;
}

/** zip 안의 낱장 이름. 순서대로 정렬되도록 자릿수를 맞춘다. 예: frame-01.png */
export function frameFileName(index: number, count: number): string {
  const digits = Math.max(2, String(count).length);
  return `frame-${String(index + 1).padStart(digits, '0')}.png`;
}

/** PixelBuffer를 PNG로 만든다. 투명 픽셀은 투명으로 남는다. */
export async function encodePng(image: PixelBuffer): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 쓸 수 없어요');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG로 바꾸지 못했어요'))), 'image/png');
  });
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/**
 * 픽셀 결과를 PNG 파일로 내려받는다. 배율 1이 원래 해상도다.
 * 투명 픽셀은 파일에서도 투명으로 저장된다.
 */
export async function savePixelPng(image: PixelBuffer, scale: number): Promise<void> {
  download(await encodePng(scaleBuffer(image, scale)), exportFileName(image.width, image.height, scale));
}

/** 프레임을 한 줄에 SHEET_COLUMNS개씩, 칸 사이 여백 없이 붙인 스프라이트 시트 PNG 한 장을 내려받는다. */
export async function saveSheetPng(frames: PixelBuffer[]): Promise<void> {
  const sheet = buildSheet(frames, SHEET_COLUMNS);
  download(await encodePng(sheet), animationFileName('sheet', frames[0]!.width, frames[0]!.height, frames.length));
}

/** 프레임을 낱장 PNG(frame-01.png …)로 만들어 zip 하나로 내려받는다. */
export async function saveFramesZip(frames: PixelBuffer[]): Promise<void> {
  const files = await Promise.all(
    frames.map(async (frame, i) => ({
      name: frameFileName(i, frames.length),
      data: new Uint8Array(await (await encodePng(frame)).arrayBuffer()),
    })),
  );
  const zip = createZip(files);
  download(
    new Blob([zip as BlobPart], { type: 'application/zip' }),
    animationFileName('frames', frames[0]!.width, frames[0]!.height, frames.length),
  );
}
