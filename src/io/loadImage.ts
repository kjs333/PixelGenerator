import { MAX_SOURCE_SIZE } from '../config/constants';
import { scaleToFit } from '../core/fit';
import type { PixelBuffer } from '../core/types';
import { validateImageBytes } from '../security/validateFile';

export type LoadFailure = 'empty' | 'too-large' | 'unsupported-type' | 'decode-failed';

export class LoadError extends Error {
  constructor(readonly reason: LoadFailure) {
    super(reason);
    this.name = 'LoadError';
  }
}

export interface LoadedImage {
  buffer: PixelBuffer;
  /** 4096px보다 커서 줄였는지 */
  scaled: boolean;
}

const HEAD_BYTES = 12;

/**
 * 파일 → PixelBuffer.
 * 캔버스에 다시 그리므로 EXIF(위치정보 등) 메타데이터는 버려진다.
 */
export async function loadImage(file: File): Promise<LoadedImage> {
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const checked = validateImageBytes(head, file.size);
  if (!checked.ok) throw new LoadError(checked.reason);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new LoadError('decode-failed');
  }

  try {
    const fit = scaleToFit(bitmap.width, bitmap.height, MAX_SOURCE_SIZE);
    const canvas = document.createElement('canvas');
    canvas.width = fit.width;
    canvas.height = fit.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new LoadError('decode-failed');
    ctx.drawImage(bitmap, 0, 0, fit.width, fit.height);
    const pixels = ctx.getImageData(0, 0, fit.width, fit.height);
    const buffer: PixelBuffer = {
      width: pixels.width,
      height: pixels.height,
      data: new Uint8ClampedArray(pixels.data),
    };
    return { buffer, scaled: fit.scaled };
  } finally {
    bitmap.close();
  }
}
