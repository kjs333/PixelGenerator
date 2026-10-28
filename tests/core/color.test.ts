import { describe, expect, test } from 'vitest';
import { colorDistanceSq, luminance, nearestIndex } from '../../src/core/color';
import type { RGBA } from '../../src/core/types';

describe('color', () => {
  test('같은 색의 거리는 0이다', () => {
    expect(colorDistanceSq([10, 20, 30, 255], [10, 20, 30, 255])).toBe(0);
  });

  test('거리는 RGB 차이의 제곱합이다', () => {
    expect(colorDistanceSq([0, 0, 0, 255], [3, 4, 0, 255])).toBe(25);
  });

  test('nearestIndex는 가장 가까운 팔레트 색의 번호를 돌려준다', () => {
    const palette: RGBA[] = [
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ];
    expect(nearestIndex(palette, [30, 30, 30, 255])).toBe(0);
    expect(nearestIndex(palette, [200, 200, 200, 255])).toBe(1);
  });

  test('거리가 같으면 앞쪽 번호를 고른다(결정성)', () => {
    const palette: RGBA[] = [
      [0, 0, 0, 255],
      [254, 254, 254, 255],
    ];
    expect(nearestIndex(palette, [127, 127, 127, 255])).toBe(0);
  });

  test('밝기는 흰색이 검정보다 크고 초록이 파랑보다 크다', () => {
    expect(luminance([255, 255, 255, 255])).toBeGreaterThan(luminance([0, 0, 0, 255]));
    expect(luminance([0, 255, 0, 255])).toBeGreaterThan(luminance([0, 0, 255, 255]));
  });

  test('팔레트가 비어 있으면 nearestIndex는 오류를 낸다', () => {
    expect(() => nearestIndex([], [0, 0, 0, 255])).toThrow(Error);
  });
});
