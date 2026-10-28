import { describe, expect, test } from 'vitest';
import { downscale } from '../../src/core/downscale';
import { fromPixels, pixelAt, solid } from '../helpers';

describe('downscale', () => {
  test('결과 크기는 요청한 크기와 정확히 같다', () => {
    const out = downscale(solid(100, 60, [10, 20, 30, 255]), 16, 12);
    expect(out.width).toBe(16);
    expect(out.height).toBe(12);
    expect(out.data.length).toBe(16 * 12 * 4);
  });

  test('단색 이미지는 단색 결과가 된다', () => {
    const out = downscale(solid(40, 40, [200, 100, 50, 255]), 8, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(pixelAt(out, x, y)).toEqual([200, 100, 50, 255]);
      }
    }
  });

  test('목표 픽셀 하나는 원본 영역의 평균색이다', () => {
    const src = fromPixels(2, 1, [
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ]);
    expect(pixelAt(downscale(src, 1, 1), 0, 0)).toEqual([128, 128, 128, 255]);
  });

  test('가로로 긴 이미지는 자르지 않고 위아래에 투명 여백을 넣어 맞춘다', () => {
    // 4x2 이미지를 4x4로: 가운데 두 줄에 그대로 들어가고 위·아래 한 줄씩은 여백
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const green: [number, number, number, number] = [0, 255, 0, 255];
    const blue: [number, number, number, number] = [0, 0, 255, 255];
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const src = fromPixels(4, 2, [red, green, blue, white, red, green, blue, white]);
    const out = downscale(src, 4, 4);
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(out, 3, 3)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(out, 0, 1)).toEqual(red);
    expect(pixelAt(out, 3, 1)).toEqual(white); // 맨 오른쪽 열도 잘리지 않는다
    expect(pixelAt(out, 0, 2)).toEqual(red);
    expect(pixelAt(out, 3, 2)).toEqual(white);
  });

  test('세로로 긴 이미지는 자르지 않고 좌우에 투명 여백을 넣어 맞춘다', () => {
    // 2x4 이미지를 4x4로: 가운데 두 열에 들어가고 왼쪽·오른쪽 한 열씩은 여백
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const blue: [number, number, number, number] = [0, 0, 255, 255];
    const src = fromPixels(2, 4, [red, blue, red, blue, red, blue, red, blue]);
    const out = downscale(src, 4, 4);
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(out, 3, 3)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(out, 1, 0)).toEqual(red);
    expect(pixelAt(out, 2, 0)).toEqual(blue);
    expect(pixelAt(out, 1, 3)).toEqual(red); // 맨 아래 줄도 잘리지 않는다
  });

  test('투명한 픽셀은 색 평균에 섞이지 않는다', () => {
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const clear: [number, number, number, number] = [0, 0, 0, 0];
    const src = fromPixels(2, 2, [red, red, red, clear]);
    expect(pixelAt(downscale(src, 1, 1), 0, 0)).toEqual([255, 0, 0, 255]);
  });

  test('불투명 비율이 절반 미만이면 완전 투명 픽셀이 된다', () => {
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const clear: [number, number, number, number] = [0, 0, 0, 0];
    const src = fromPixels(2, 2, [red, clear, clear, clear]);
    expect(pixelAt(downscale(src, 1, 1), 0, 0)).toEqual([0, 0, 0, 0]);
  });

  test('원본보다 큰 목표 크기여도 오류 없이 가장 가까운 픽셀을 쓴다', () => {
    const src = fromPixels(2, 1, [
      [255, 0, 0, 255],
      [0, 0, 255, 255],
    ]);
    const out = downscale(src, 4, 2);
    expect(pixelAt(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(out, 3, 1)).toEqual([0, 0, 255, 255]);
  });

  test('목표 크기가 1 미만이거나 정수가 아니면 오류를 낸다', () => {
    const src = solid(4, 4, [0, 0, 0, 255]);
    expect(() => downscale(src, 0, 4)).toThrow(RangeError);
    expect(() => downscale(src, 4, 1.5)).toThrow(RangeError);
  });

  test('원본 버퍼를 바꾸지 않는다', () => {
    const src = solid(4, 4, [9, 9, 9, 255]);
    const before = Array.from(src.data);
    downscale(src, 2, 2);
    expect(Array.from(src.data)).toEqual(before);
  });
});
