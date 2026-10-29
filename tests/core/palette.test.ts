import { describe, expect, test } from 'vitest';
import { extractPalette } from '../../src/core/palette';
import { luminance } from '../../src/core/color';
import type { RGBA } from '../../src/core/types';
import { fromPixels, key, solid } from '../helpers';

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const WHITE: RGBA = [255, 255, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

describe('extractPalette', () => {
  test('이미지에 쓰인 서로 다른 색을 한 번씩 돌려준다', () => {
    const palette = extractPalette(fromPixels(2, 2, [RED, RED, BLUE, WHITE]));
    expect(palette.map(key).sort()).toEqual([key(RED), key(BLUE), key(WHITE)].sort());
  });

  test('투명 픽셀은 팔레트에 넣지 않는다', () => {
    expect(extractPalette(fromPixels(2, 1, [RED, CLEAR]))).toEqual([RED]);
  });

  test('어두운 색에서 밝은 색 순서로 정렬한다', () => {
    const lums = extractPalette(fromPixels(3, 1, [WHITE, BLUE, RED])).map(luminance);
    expect(lums).toEqual([...lums].sort((a, b) => a - b));
  });

  test('전부 투명하면 빈 목록이다', () => {
    expect(extractPalette(solid(3, 3, CLEAR))).toEqual([]);
  });
});
