import { describe, expect, test } from 'vitest';
import { pixelate } from '../../src/core/pixelate';
import type { ConvertOptions } from '../../src/core/types';
import { colorfulGradient, fromPixels, key, pixelAt, solid } from '../helpers';
import { MAX_ART_SIZE } from '../../src/config/constants';

const BASE: ConvertOptions = { width: 16, height: 16, colors: 8, dither: 'none', cleanup: false };

describe('pixelate', () => {
  test('결과 이미지는 요청한 해상도다', () => {
    const { image } = pixelate(colorfulGradient(64, 64), { ...BASE, width: 8, height: 8 });
    expect(image.width).toBe(8);
    expect(image.height).toBe(8);
  });

  test('팔레트는 요청한 색 수를 넘지 않고 모든 픽셀이 팔레트 색이다', () => {
    const { image, palette } = pixelate(colorfulGradient(64, 64), { ...BASE, colors: 6 });
    expect(palette.length).toBeLessThanOrEqual(6);
    const allowed = new Set(palette.map(key));
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        expect(allowed.has(key(pixelAt(image, x, y)))).toBe(true);
      }
    }
  });

  test('같은 입력과 옵션은 항상 같은 결과를 낸다(결정성)', () => {
    const src = colorfulGradient(48, 32);
    expect(pixelate(src, BASE)).toEqual(pixelate(src, BASE));
  });

  test('색 수 옵션을 바꾸면 팔레트가 달라진다', () => {
    const src = colorfulGradient(64, 64);
    const few = pixelate(src, { ...BASE, colors: 4 }).palette;
    const many = pixelate(src, { ...BASE, colors: 16 }).palette;
    expect(many.length).toBeGreaterThan(few.length);
  });

  test('디더링 옵션을 바꾸면 결과 이미지가 달라진다', () => {
    const src = colorfulGradient(64, 64);
    const plain = pixelate(src, { ...BASE, colors: 4, dither: 'none' }).image;
    const bayer = pixelate(src, { ...BASE, colors: 4, dither: 'bayer' }).image;
    const fs = pixelate(src, { ...BASE, colors: 4, dither: 'floyd-steinberg' }).image;
    expect(Array.from(bayer.data)).not.toEqual(Array.from(plain.data));
    expect(Array.from(fs.data)).not.toEqual(Array.from(plain.data));
  });

  test('디더링 없음: 경계에서 색을 섞지 않아 원본에 없는 중간색이 생기지 않는다', () => {
    // 왼쪽 빨강 / 오른쪽 파랑, 칸 경계가 두 색에 걸쳐도 결과는 빨강과 파랑뿐
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const blue: [number, number, number, number] = [0, 0, 255, 255];
    const pixels = Array.from({ length: 30 * 30 }, (_, i) => (i % 30 < 14 ? red : blue));
    const { image } = pixelate(fromPixels(30, 30, pixels), { ...BASE, width: 4, height: 4, colors: 4 });
    const seen = new Set<string>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.add(key(pixelAt(image, x, y)));
    expect([...seen].every((k) => k === key(red) || k === key(blue))).toBe(true);
  });

  test.each(['none', 'bayer', 'floyd-steinberg'] as const)(
    '%s: 가로로 긴 이미지도 양 끝이 잘리지 않고 위아래에 투명 여백이 생긴다',
    (dither) => {
      // 왼쪽 빨강 / 오른쪽 파랑인 16×4 이미지를 8×8로
      const red: [number, number, number, number] = [255, 0, 0, 255];
      const blue: [number, number, number, number] = [0, 0, 255, 255];
      const pixels = Array.from({ length: 16 * 4 }, (_, i) => (i % 16 < 8 ? red : blue));
      const { image } = pixelate(fromPixels(16, 4, pixels), { ...BASE, width: 8, height: 8, colors: 4, dither });
      expect(pixelAt(image, 0, 3)).toEqual(red); // 내용은 가운데 2줄(세로 3~4)
      expect(pixelAt(image, 7, 3)).toEqual(blue);
      expect(pixelAt(image, 0, 0)[3]).toBe(0); // 위쪽 여백
      expect(pixelAt(image, 7, 7)[3]).toBe(0); // 아래쪽 여백
    },
  );

  test('외톨이 정리를 켜면 결과의 외톨이 칸이 줄어든다', () => {
    const noisy = fromPixels(
      64,
      64,
      Array.from({ length: 64 * 64 }, (_, i) => {
        const n = ((i * 2654435761) >>> 0) % 61; // 결정적인 잡음 0~60
        return [120 + n, 170 + (n % 40), 230 + (n % 25), 255];
      }),
    );
    const countOrphans = (img: { width: number; height: number; data: Uint8ClampedArray }) => {
      let orphans = 0;
      const at = (x: number, y: number) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)).join(',');
      for (let y = 1; y < img.height - 1; y++)
        for (let x = 1; x < img.width - 1; x++) {
          const c = at(x, y);
          if ([at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].every((n) => n !== c)) orphans++;
        }
      return orphans;
    };
    const opt = { ...BASE, width: 32, height: 32, colors: 8 };
    const without = countOrphans(pixelate(noisy, { ...opt, cleanup: false }).image);
    const withCleanup = countOrphans(pixelate(noisy, { ...opt, cleanup: true }).image);
    expect(without).toBeGreaterThan(0);
    expect(withCleanup).toBeLessThan(without);
  });

  test('디더링을 켜면 외톨이 정리를 켜도 디더링 무늬를 지우지 않는다', () => {
    const src = colorfulGradient(64, 64);
    const opt = { ...BASE, width: 16, height: 16, colors: 4, dither: 'bayer' as const };
    expect(pixelate(src, { ...opt, cleanup: true })).toEqual(pixelate(src, { ...opt, cleanup: false }));
  });

  test('전부 투명한 이미지는 오류 없이 투명한 결과와 빈 팔레트를 돌려준다', () => {
    const { image, palette } = pixelate(solid(8, 8, [0, 0, 0, 0]), BASE);
    expect(palette).toEqual([]);
    expect(pixelAt(image, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  test('원본 버퍼를 바꾸지 않는다', () => {
    const src = colorfulGradient(32, 32);
    const before = Array.from(src.data);
    pixelate(src, BASE);
    expect(Array.from(src.data)).toEqual(before);
  });

  test('해상도가 1 미만이거나 상한을 넘거나 정수가 아니면 오류를 낸다', () => {
    const src = colorfulGradient(8, 8);
    expect(() => pixelate(src, { ...BASE, width: 0 })).toThrow(RangeError);
    expect(() => pixelate(src, { ...BASE, height: MAX_ART_SIZE + 1 })).toThrow(RangeError);
    expect(() => pixelate(src, { ...BASE, width: 8.5 })).toThrow(RangeError);
  });

  test('색 수가 허용 범위(4~32) 밖이면 오류를 낸다', () => {
    const src = colorfulGradient(8, 8);
    expect(() => pixelate(src, { ...BASE, colors: 3 })).toThrow(RangeError);
    expect(() => pixelate(src, { ...BASE, colors: 33 })).toThrow(RangeError);
  });
});
