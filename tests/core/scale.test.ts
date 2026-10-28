import { describe, expect, test } from 'vitest';
import { scaleBuffer } from '../../src/core/scale';
import type { RGBA } from '../../src/core/types';
import { fromPixels, pixelAt } from '../helpers';

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

describe('scaleBuffer', () => {
  test('1배는 같은 크기와 같은 픽셀의 복사본이다', () => {
    const src = fromPixels(2, 1, [RED, BLUE]);
    const out = scaleBuffer(src, 1);
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
    expect(out.data).not.toBe(src.data);
  });

  test('n배는 가로세로가 n배가 된다', () => {
    const out = scaleBuffer(fromPixels(3, 2, Array.from({ length: 6 }, () => RED)), 4);
    expect(out.width).toBe(12);
    expect(out.height).toBe(8);
    expect(out.data.length).toBe(12 * 8 * 4);
  });

  test('원래 픽셀 하나가 n×n 칸으로 그대로 커진다(색을 섞지 않는다)', () => {
    const out = scaleBuffer(fromPixels(2, 1, [RED, BLUE]), 3);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(pixelAt(out, x, y)).toEqual(RED);
        expect(pixelAt(out, x + 3, y)).toEqual(BLUE);
      }
    }
  });

  test('투명 픽셀은 투명으로 커진다', () => {
    const out = scaleBuffer(fromPixels(2, 1, [CLEAR, RED]), 2);
    expect(pixelAt(out, 0, 0)).toEqual(CLEAR);
    expect(pixelAt(out, 1, 1)).toEqual(CLEAR);
    expect(pixelAt(out, 2, 0)).toEqual(RED);
  });

  test('원본 버퍼를 바꾸지 않는다', () => {
    const src = fromPixels(2, 2, [RED, BLUE, BLUE, RED]);
    const before = Array.from(src.data);
    scaleBuffer(src, 8);
    expect(Array.from(src.data)).toEqual(before);
  });

  test('배율이 1 미만이거나 정수가 아니면 오류를 낸다', () => {
    const src = fromPixels(1, 1, [RED]);
    expect(() => scaleBuffer(src, 0)).toThrow(RangeError);
    expect(() => scaleBuffer(src, -2)).toThrow(RangeError);
    expect(() => scaleBuffer(src, 1.5)).toThrow(RangeError);
  });
});
