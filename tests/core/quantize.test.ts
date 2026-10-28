import { describe, expect, test } from 'vitest';
import { quantize } from '../../src/core/quantize';
import { luminance } from '../../src/core/color';
import { fromPixels, grayGradient, key, solid } from '../helpers';

describe('quantize', () => {
  test('서로 다른 색이 요청 수보다 적으면 그 색들만 팔레트가 된다', () => {
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const blue: [number, number, number, number] = [0, 0, 255, 255];
    const palette = quantize(fromPixels(2, 1, [red, blue]), 16);
    expect(palette.map(key).sort()).toEqual([key(red), key(blue)].sort());
  });

  test('색이 많은 이미지도 요청한 색 수까지만 만든다', () => {
    const palette = quantize(grayGradient(64, 1), 4);
    expect(palette.length).toBe(4);
  });

  test('같은 입력은 항상 같은 팔레트를 만든다(결정성)', () => {
    const img = grayGradient(50, 3);
    expect(quantize(img, 6)).toEqual(quantize(img, 6));
  });

  test('팔레트는 어두운 색에서 밝은 색 순서로 정렬된다', () => {
    const palette = quantize(grayGradient(64, 1), 5);
    const lums = palette.map(luminance);
    expect(lums).toEqual([...lums].sort((a, b) => a - b));
  });

  test('투명한 픽셀은 팔레트에 들어가지 않는다', () => {
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const clear: [number, number, number, number] = [0, 0, 0, 0];
    const palette = quantize(fromPixels(2, 1, [red, clear]), 8);
    expect(palette).toEqual([red]);
  });

  test('전부 투명하면 빈 팔레트를 돌려준다', () => {
    expect(quantize(solid(3, 3, [0, 0, 0, 0]), 8)).toEqual([]);
  });

  test('팔레트의 색은 모두 불투명이다', () => {
    const palette = quantize(grayGradient(32, 2), 8);
    expect(palette.every((c) => c[3] === 255)).toBe(true);
  });

  test('대표색은 평균이 아니라 박스 안에서 가장 많이 나온 실제 색이다', () => {
    // 빨강 9개 + 주황 1개를 한 박스로 묶으면, 평균(255,13,0)이 아니라 빨강 그대로
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const orange: [number, number, number, number] = [255, 128, 0, 255];
    const pixels = [...Array.from({ length: 9 }, () => red), orange];
    expect(quantize(fromPixels(10, 1, pixels), 1)).toEqual([red]);
  });

  test('팔레트의 색은 모두 원본 이미지에 실제로 있는 색이다', () => {
    const img = grayGradient(50, 2);
    const present = new Set<string>();
    for (let i = 0; i < img.data.length; i += 4) {
      present.add([img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]].join(','));
    }
    expect(quantize(img, 6).every((c) => present.has(key(c)))).toBe(true);
  });

  test('면적이 작은 단색도 팔레트에서 사라지지 않는다(안티앨리어싱 경계색이 많아도)', () => {
    type C = [number, number, number, number];
    const white: C = [255, 255, 255, 255];
    const flats: { color: C; count: number }[] = [
      { color: [220, 40, 40, 255], count: 800 }, // 빨강
      { color: [40, 80, 220, 255], count: 600 }, // 파랑
      { color: [0, 0, 0, 255], count: 150 }, // 검정
      { color: [30, 160, 60, 255], count: 60 }, // 초록(작음)
      { color: [250, 200, 30, 255], count: 40 }, // 노랑(작음)
    ];
    const pixels: C[] = Array.from({ length: 4000 }, () => white);
    for (const { color, count } of flats) {
      for (let i = 0; i < count; i++) pixels.push(color);
      // 흰색과 섞인 경계색 9단계, 각 8픽셀
      for (let step = 1; step <= 9; step++) {
        const t = step / 10;
        const blend: C = [0, 1, 2].map((c) => Math.round(255 + (color[c]! - 255) * t)).concat(255) as C;
        for (let i = 0; i < 8; i++) pixels.push(blend);
      }
    }
    const palette = quantize(fromPixels(pixels.length, 1, pixels), 6);
    const have = new Set(palette.map(key));
    for (const color of [white, ...flats.map((f) => f.color)]) {
      expect(have.has(key(color)), `팔레트에 ${key(color)} 이(가) 없어요`).toBe(true);
    }
  });

  test('성격이 다른 두 무리(초록 땅, 어두운 붉은 그림자)가 한 색으로 합쳐지지 않는다', () => {
    type C = [number, number, number, number];
    const noisy = (base: C, n: number, seed: number): C[] =>
      Array.from({ length: n }, (_, i) => {
        const d = ((i * 37 + seed) % 9) - 4;
        return [base[0] + d, base[1] + d, base[2] + d, 255];
      });
    const pixels: C[] = [
      ...noisy([150, 200, 250, 255], 800, 1), // 하늘
      ...noisy([60, 110, 55, 255], 600, 2), // 초록 땅
      ...noisy([60, 20, 20, 255], 100, 3), // 어두운 붉은 그림자
      ...noisy([230, 90, 80, 255], 200, 4), // 밝은 빨강
    ];
    const palette = quantize(fromPixels(pixels.length, 1, pixels), 4);
    const hasGreen = palette.some((c) => c[1] > c[0] + 30 && c[1] > c[2] + 30);
    const hasDarkRed = palette.some((c) => c[0] > c[1] + 25 && c[0] < 120);
    expect(hasGreen).toBe(true);
    expect(hasDarkRed).toBe(true);
  });

  test('개수 차이가 작으면 가장 많은 색이 아니라 무리 중심에 가까운 색을 고른다', () => {
    // 한 무리: 100은 2개, 128과 156은 1개씩. 가장 많은 색(100)은 가장자리라서 중심(121)에 가까운 128이 대표
    const gray = (v: number): [number, number, number, number] => [v, v, v, 255];
    const pixels = [gray(100), gray(100), gray(128), gray(156)];
    expect(quantize(fromPixels(4, 1, pixels), 1)).toEqual([gray(128)]);
  });

  test('요청한 색 수가 1 미만이면 오류를 낸다', () => {
    expect(() => quantize(grayGradient(4, 1), 0)).toThrow(RangeError);
  });
});
