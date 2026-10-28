import { describe, expect, test } from 'vitest';
import { validateImageBytes } from '../../src/security/validateFile';
import { MAX_FILE_BYTES } from '../../src/config/constants';

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = Uint8Array.from([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')]);
const WAV = Uint8Array.from([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')]);

describe('validateImageBytes', () => {
  test('PNG, JPEG, WebP는 앞부분 바이트로 형식을 알아낸다', () => {
    expect(validateImageBytes(PNG, 1000)).toEqual({ ok: true, type: 'png' });
    expect(validateImageBytes(JPEG, 1000)).toEqual({ ok: true, type: 'jpeg' });
    expect(validateImageBytes(WEBP, 1000)).toEqual({ ok: true, type: 'webp' });
  });

  test('확장자가 아니라 내용을 본다: 텍스트 파일은 거부한다', () => {
    expect(validateImageBytes(ascii('hello world!'), 1000)).toEqual({
      ok: false,
      reason: 'unsupported-type',
    });
  });

  test('SVG는 거부한다', () => {
    expect(validateImageBytes(ascii('<svg xmlns="http'), 1000)).toEqual({
      ok: false,
      reason: 'unsupported-type',
    });
  });

  test('RIFF 컨테이너라도 WebP가 아니면 거부한다', () => {
    expect(validateImageBytes(WAV, 1000)).toEqual({ ok: false, reason: 'unsupported-type' });
  });

  test('앞부분이 너무 짧으면 거부한다', () => {
    expect(validateImageBytes(Uint8Array.from([0x89, 0x50]), 2)).toEqual({
      ok: false,
      reason: 'unsupported-type',
    });
  });

  test('10MB는 통과하고 10MB보다 1바이트라도 크면 거부한다', () => {
    expect(validateImageBytes(PNG, MAX_FILE_BYTES).ok).toBe(true);
    expect(validateImageBytes(PNG, MAX_FILE_BYTES + 1)).toEqual({
      ok: false,
      reason: 'too-large',
    });
  });

  test('크기가 0이면 빈 파일로 거부한다', () => {
    expect(validateImageBytes(new Uint8Array(0), 0)).toEqual({ ok: false, reason: 'empty' });
  });

  test('형식이 틀려도 너무 큰 파일은 크기 오류를 먼저 알린다', () => {
    expect(validateImageBytes(ascii('hello world!'), MAX_FILE_BYTES + 1)).toEqual({
      ok: false,
      reason: 'too-large',
    });
  });
});
