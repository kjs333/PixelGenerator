import { describe, expect, it } from 'vitest';
import { checkPixelArt, detectScale } from '../../src/core/pixelArt';
import { scaleBuffer as upscale } from '../../src/core/scale';
import type { RGBA } from '../../src/core/types';
import { colorfulGradient, fromPixels, key, pixelAt, solid } from '../helpers';

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

/** 2×2 체크무늬(빨강·파랑) */
const checker = () => fromPixels(2, 2, [RED, BLUE, BLUE, RED]);

describe('detectScale', () => {
  it('확대하지 않은 그림은 1', () => {
    expect(detectScale(checker())).toBe(1);
  });

  it('정수 배로 키운 그림은 그 배율', () => {
    expect(detectScale(upscale(checker(), 4))).toBe(4);
    expect(detectScale(upscale(fromPixels(3, 1, [RED, BLUE, RED]), 8))).toBe(8);
  });

  it('한 색으로 꽉 찬 그림은 가로·세로의 최대공약수', () => {
    expect(detectScale(solid(12, 8, RED))).toBe(4);
  });

  it('칸이 어긋나면(한 줄만 다른 길이) 1', () => {
    // 가로 3칸 중 첫 칸만 1px → 칸 크기가 맞지 않음
    expect(detectScale(fromPixels(3, 1, [RED, BLUE, BLUE]))).toBe(1);
  });
});

describe('checkPixelArt', () => {
  it('작고 색이 적은 그림은 그대로 받는다', () => {
    const result = checkPixelArt(checker());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scale).toBe(1);
    expect(result.image.width).toBe(2);
  });

  it('확대본은 원래 크기로 줄여서 받는다', () => {
    const big = upscale(fromPixels(2, 1, [RED, CLEAR]), 8);
    const result = checkPixelArt(big);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scale).toBe(8);
    expect([result.image.width, result.image.height]).toEqual([2, 1]);
    expect(key(pixelAt(result.image, 0, 0))).toBe(key(RED));
    expect(pixelAt(result.image, 1, 0)[3]).toBe(0);
  });

  it('줄여도 256보다 크면 too-large', () => {
    const result = checkPixelArt(colorfulGradient(300, 10));
    expect(result).toEqual({ ok: false, reason: 'too-large' });
  });

  it('색이 64개보다 많으면 too-many-colors', () => {
    const result = checkPixelArt(colorfulGradient(64, 64));
    expect(result).toEqual({ ok: false, reason: 'too-many-colors' });
  });

  it('투명한 칸은 색 하나로 센다', () => {
    const pixels: RGBA[] = Array.from({ length: 100 }, (_, i) => [i, i, i, 0]);
    expect(checkPixelArt(fromPixels(10, 10, pixels)).ok).toBe(true);
  });
});
