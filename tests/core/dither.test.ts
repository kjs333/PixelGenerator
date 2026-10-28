import { describe, expect, test } from 'vitest';
import { dither } from '../../src/core/dither';
import type { DitherMode, RGBA } from '../../src/core/types';
import { colorfulGradient, fromPixels, key, pixelAt, solid } from '../helpers';

const BLACK: RGBA = [0, 0, 0, 255];
const WHITE: RGBA = [255, 255, 255, 255];
const MODES: DitherMode[] = ['none', 'bayer', 'floyd-steinberg'];

describe('dither', () => {
  test('none은 각 픽셀을 가장 가까운 팔레트 색으로 바꾼다', () => {
    const src = fromPixels(2, 1, [
      [30, 30, 30, 255],
      [220, 220, 220, 255],
    ]);
    const out = dither(src, [BLACK, WHITE], 'none');
    expect(pixelAt(out, 0, 0)).toEqual(BLACK);
    expect(pixelAt(out, 1, 0)).toEqual(WHITE);
  });

  test.each(MODES)('%s: 결과 픽셀은 모두 팔레트 안의 색이다', (mode) => {
    const palette: RGBA[] = [BLACK, WHITE, [255, 0, 0, 255], [0, 0, 255, 255]];
    const out = dither(colorfulGradient(16, 16), palette, mode);
    const allowed = new Set(palette.map(key));
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        expect(allowed.has(key(pixelAt(out, x, y)))).toBe(true);
      }
    }
  });

  test.each(MODES)('%s: 투명 픽셀은 투명으로 남는다', (mode) => {
    const src = fromPixels(3, 1, [[128, 128, 128, 255], [0, 0, 0, 0], [128, 128, 128, 255]]);
    const out = dither(src, [BLACK, WHITE], mode);
    expect(pixelAt(out, 1, 0)).toEqual([0, 0, 0, 0]);
  });

  test.each(['bayer', 'floyd-steinberg'] as DitherMode[])(
    '%s: 중간 회색은 흑백이 섞인 무늬가 된다',
    (mode) => {
      const out = dither(solid(8, 8, [128, 128, 128, 255]), [BLACK, WHITE], mode);
      const used = new Set<string>();
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) used.add(key(pixelAt(out, x, y)));
      expect(used.size).toBe(2);
    },
  );

  test('none은 중간 회색을 한 색으로만 칠한다', () => {
    const out = dither(solid(8, 8, [128, 128, 128, 255]), [BLACK, WHITE], 'none');
    const used = new Set<string>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) used.add(key(pixelAt(out, x, y)));
    expect(used.size).toBe(1);
  });

  test('같은 입력은 같은 결과를 낸다(결정성)', () => {
    const img = colorfulGradient(12, 12);
    const palette: RGBA[] = [BLACK, WHITE, [255, 0, 0, 255]];
    for (const mode of MODES) {
      expect(dither(img, palette, mode)).toEqual(dither(img, palette, mode));
    }
  });

  test('원본 버퍼를 바꾸지 않는다', () => {
    const src = colorfulGradient(6, 6);
    const before = Array.from(src.data);
    dither(src, [BLACK, WHITE], 'floyd-steinberg');
    expect(Array.from(src.data)).toEqual(before);
  });

  test('팔레트가 비어 있으면 오류를 낸다', () => {
    expect(() => dither(solid(2, 2, [1, 2, 3, 255]), [], 'none')).toThrow(Error);
  });
});
