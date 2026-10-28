import { describe, expect, test } from 'vitest';
import { cleanupOrphans } from '../../src/core/cleanup';
import type { RGBA } from '../../src/core/types';
import { fromPixels, pixelAt, solid } from '../helpers';

const SKY: RGBA = [150, 200, 250, 255];
const SKY_ODD: RGBA = [170, 190, 255, 255]; // 하늘과 밝기가 비슷한 다른 색
const BLACK: RGBA = [0, 0, 0, 255];
const LIGHT: RGBA = [200, 200, 200, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

/** 5×5 단색 이미지의 가운데 칸만 다른 색으로 바꾼다. */
function withCenter(base: RGBA, center: RGBA) {
  const img = solid(5, 5, base);
  img.data.set(center, (2 * 5 + 2) * 4);
  return img;
}

describe('cleanupOrphans', () => {
  test('주변과 색이 모두 다르고 밝기가 비슷한 외톨이 칸은 주변 색으로 바뀐다', () => {
    const out = cleanupOrphans(withCenter(SKY, SKY_ODD));
    expect(pixelAt(out, 2, 2)).toEqual(SKY);
  });

  test('밝기 차이가 큰 외톨이(눈동자 같은 의도한 점)는 남긴다', () => {
    const out = cleanupOrphans(withCenter(LIGHT, BLACK));
    expect(pixelAt(out, 2, 2)).toEqual(BLACK);
  });

  test('같은 색 이웃이 하나라도 있으면(두 칸짜리 무리) 남긴다', () => {
    const img = solid(5, 5, SKY);
    img.data.set(SKY_ODD, (2 * 5 + 2) * 4);
    img.data.set(SKY_ODD, (2 * 5 + 3) * 4);
    const out = cleanupOrphans(img);
    expect(pixelAt(out, 2, 2)).toEqual(SKY_ODD);
    expect(pixelAt(out, 3, 2)).toEqual(SKY_ODD);
  });

  test('주변 8칸 중 가장 많은 색으로 바꾼다', () => {
    const other: RGBA = [150, 205, 245, 255];
    // 가운데 칸 주변: SKY 5칸, other 3칸
    const out = cleanupOrphans(
      fromPixels(3, 3, [SKY, other, SKY, other, SKY_ODD, SKY, SKY, other, SKY]),
    );
    expect(pixelAt(out, 1, 1)).toEqual(SKY);
  });

  test('투명 칸은 그대로 두고, 불투명 이웃이 3칸 미만이면 건드리지 않는다', () => {
    const img = solid(5, 5, SKY);
    img.data.set(CLEAR, (2 * 5 + 2) * 4); // 가운데 투명
    img.data.set(SKY_ODD, 0); // 모서리(이웃 2칸)
    const out = cleanupOrphans(img);
    expect(pixelAt(out, 2, 2)).toEqual(CLEAR);
    expect(pixelAt(out, 0, 0)).toEqual(SKY_ODD);
  });

  test('바꿀 때는 원본 이미지의 이웃을 기준으로 하므로 칸을 훑는 순서에 영향받지 않는다', () => {
    // 서로 이웃한 외톨이 둘: 각자 원래 이웃 기준으로 판단한다
    const a: RGBA = [160, 195, 252, 255];
    const b: RGBA = [140, 205, 248, 255];
    const img = solid(5, 5, SKY);
    img.data.set(a, (2 * 5 + 1) * 4);
    img.data.set(b, (2 * 5 + 2) * 4);
    const out = cleanupOrphans(img);
    expect(pixelAt(out, 1, 2)).toEqual(SKY);
    expect(pixelAt(out, 2, 2)).toEqual(SKY);
  });

  test('원본 버퍼를 바꾸지 않는다', () => {
    const img = withCenter(SKY, SKY_ODD);
    const before = Array.from(img.data);
    cleanupOrphans(img);
    expect(Array.from(img.data)).toEqual(before);
  });
});
