import { describe, expect, test } from 'vitest';
import { base64ToBytes, bytesToBase64, pngSize } from '../../src/io/base64';
import { pngHeader } from '../helpers';

describe('base64', () => {
  test('바이트 → base64 → 바이트가 같다', () => {
    const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => (i * 31) % 256); // 나눠서 바꾸는 경계를 넘는 길이
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  test('data: 머리말이 붙어 있어도 읽는다', () => {
    expect(base64ToBytes('data:image/png;base64,AQID')).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('base64가 아니면 오류를 낸다', () => {
    expect(() => base64ToBytes('@@@')).toThrow();
  });
});

describe('pngSize', () => {
  test('IHDR에서 가로·세로를 읽는다', () => {
    expect(pngSize(pngHeader(48, 32))).toEqual({ width: 48, height: 32 });
  });

  test('PNG가 아니거나 너무 짧으면 null', () => {
    expect(
      pngSize(new Uint8Array([0xff, 0xd8, 0xff, ...new Array<number>(30).fill(0)])),
    ).toBeNull();
    expect(pngSize(pngHeader(1, 1).subarray(0, 20))).toBeNull();
  });
});
