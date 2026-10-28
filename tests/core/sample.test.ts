import { describe, expect, test } from 'vitest';
import { sampleNearest } from '../../src/core/sample';
import { fromPixels, key, pixelAt, solid } from '../helpers';
import type { RGBA } from '../../src/core/types';

describe('sampleNearest', () => {
  test('픽셀 수가 상한 이하이면 그대로 돌려준다', () => {
    const src = solid(10, 10, [1, 2, 3, 255]);
    const out = sampleNearest(src, 100);
    expect(out.width).toBe(10);
    expect(out.height).toBe(10);
  });

  test('상한을 넘으면 건너뛰며 뽑아 픽셀 수를 상한 이하로 줄인다', () => {
    const out = sampleNearest(solid(400, 400, [1, 2, 3, 255]), 1000);
    expect(out.width * out.height).toBeLessThanOrEqual(1000);
    expect(out.width).toBeGreaterThan(1);
  });

  test('색을 섞지 않고 원본에 있는 색만 뽑는다', () => {
    const red: RGBA = [255, 0, 0, 255];
    const blue: RGBA = [0, 0, 255, 255];
    const pixels: RGBA[] = [];
    for (let i = 0; i < 40 * 40; i++) pixels.push(i % 3 === 0 ? red : blue);
    const out = sampleNearest(fromPixels(40, 40, pixels), 100);
    const seen = new Set<string>();
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) seen.add(key(pixelAt(out, x, y)));
    expect([...seen].every((k) => k === key(red) || k === key(blue))).toBe(true);
  });

  test('원본 버퍼를 바꾸지 않는다', () => {
    const src = solid(30, 30, [9, 9, 9, 255]);
    const before = Array.from(src.data);
    sampleNearest(src, 100);
    expect(Array.from(src.data)).toEqual(before);
  });

  test('상한이 1 미만이면 오류를 낸다', () => {
    expect(() => sampleNearest(solid(2, 2, [0, 0, 0, 255]), 0)).toThrow(RangeError);
  });
});
