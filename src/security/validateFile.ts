import { MAX_FILE_BYTES } from '../config/constants';

export type ImageType = 'png' | 'jpeg' | 'webp';

export type ValidationResult =
  | { ok: true; type: ImageType }
  | { ok: false; reason: 'empty' | 'too-large' | 'unsupported-type' };

/** 앞부분 바이트(매직 바이트)로 형식을 판별한다. 확장자와 MIME은 믿지 않는다. */
function detectType(head: Uint8Array): ImageType | null {
  const startsWith = (bytes: number[], offset = 0) =>
    head.length >= offset + bytes.length && bytes.every((b, i) => head[offset + i] === b);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'jpeg';
  // WebP: "RIFF" + 크기 4바이트 + "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  return null;
}

export function validateImageBytes(head: Uint8Array, size: number): ValidationResult {
  if (size === 0) return { ok: false, reason: 'empty' };
  if (size > MAX_FILE_BYTES) return { ok: false, reason: 'too-large' };
  const type = detectType(head);
  if (type === null) return { ok: false, reason: 'unsupported-type' };
  return { ok: true, type };
}
