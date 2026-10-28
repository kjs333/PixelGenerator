import { describe, expect, test } from 'vitest';
import { dominantDownscale } from '../../src/core/dominant';
import type { RGBA } from '../../src/core/types';
import { fromPixels, key, pixelAt, solid } from '../helpers';

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const GREEN: RGBA = [0, 255, 0, 255];
const WHITE: RGBA = [255, 255, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

describe('dominantDownscale', () => {
  test('결과 크기는 요청한 크기와 정확히 같다', () => {
    const out = dominantDownscale(solid(100, 60, RED), 16, 12, [RED]);
    expect(out.width).toBe(16);
    expect(out.height).toBe(12);
  });

  test('칸 안에서 가장 많은 색을 쓰고 평균색은 만들지 않는다', () => {
    // 4×4 중 빨강 12, 파랑 4 → 평균(보라)이 아니라 빨강
    const pixels: RGBA[] = Array.from({ length: 16 }, (_, i) => (i % 4 === 3 ? BLUE : RED));
    const out = dominantDownscale(fromPixels(4, 4, pixels), 1, 1, [RED, BLUE]);
    expect(pixelAt(out, 0, 0)).toEqual(RED);
  });

  test('결과 픽셀은 모두 팔레트 안의 색이다', () => {
    const pixels: RGBA[] = Array.from({ length: 64 }, (_, i) => [(i * 37) % 256, (i * 91) % 256, (i * 13) % 256, 255]);
    const palette: RGBA[] = [RED, GREEN, BLUE, WHITE];
    const out = dominantDownscale(fromPixels(8, 8, pixels), 4, 4, palette);
    const allowed = new Set(palette.map(key));
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) expect(allowed.has(key(pixelAt(out, x, y)))).toBe(true);
  });

  test('각 칸은 그 칸의 영역만 본다', () => {
    // 왼쪽 반은 빨강, 오른쪽 반은 파랑 → 2×1 결과도 빨강, 파랑
    const pixels: RGBA[] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) pixels.push(x < 4 ? RED : BLUE);
    const out = dominantDownscale(fromPixels(8, 4, pixels), 2, 1, [RED, BLUE]);
    expect(pixelAt(out, 0, 0)).toEqual(RED);
    expect(pixelAt(out, 1, 0)).toEqual(BLUE);
  });

  test('가로로 긴 이미지는 자르지 않고 위아래에 투명 여백을 넣어 맞춘다', () => {
    // 4×2를 4×4로: 가운데 두 줄에 그대로 들어가고 위·아래 한 줄씩은 여백
    const row: RGBA[] = [RED, GREEN, BLUE, WHITE];
    const out = dominantDownscale(fromPixels(4, 2, [...row, ...row]), 4, 4, [RED, GREEN, BLUE, WHITE]);
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(out, 3, 3)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(out, 0, 1)).toEqual(RED);
    expect(pixelAt(out, 3, 1)).toEqual(WHITE); // 맨 오른쪽 열도 잘리지 않는다
    expect(pixelAt(out, 3, 2)).toEqual(WHITE);
  });

  test('세로로 긴 이미지는 자르지 않고 좌우에 투명 여백을 넣어 맞춘다', () => {
    const out = dominantDownscale(fromPixels(2, 4, [RED, BLUE, RED, BLUE, RED, BLUE, RED, BLUE]), 4, 4, [RED, BLUE]);
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(out, 3, 3)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(out, 1, 0)).toEqual(RED);
    expect(pixelAt(out, 2, 3)).toEqual(BLUE); // 맨 아래 줄도 잘리지 않는다
  });

  test('투명 픽셀이 절반 이상이면 투명 칸이 된다', () => {
    const out = dominantDownscale(fromPixels(2, 2, [RED, CLEAR, CLEAR, CLEAR]), 1, 1, [RED]);
    expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  test('투명이 절반 미만이면 불투명한 쪽에서 가장 많은 색을 쓴다', () => {
    const out = dominantDownscale(fromPixels(2, 2, [RED, RED, RED, CLEAR]), 1, 1, [RED, BLUE]);
    expect(pixelAt(out, 0, 0)).toEqual(RED);
  });

  test('개수가 같으면 팔레트에서 앞쪽 색을 고른다(결정성)', () => {
    const out = dominantDownscale(fromPixels(2, 1, [BLUE, RED]), 1, 1, [RED, BLUE]);
    expect(pixelAt(out, 0, 0)).toEqual(RED);
  });

  test('원본 크기보다 큰 목표 크기여도 오류 없이 가장 가까운 픽셀을 쓴다', () => {
    const out = dominantDownscale(fromPixels(2, 1, [RED, BLUE]), 4, 2, [RED, BLUE]);
    expect(pixelAt(out, 0, 0)).toEqual(RED);
    expect(pixelAt(out, 3, 1)).toEqual(BLUE);
  });

  test('팔레트가 비어 있거나 목표 크기가 잘못되면 오류를 낸다', () => {
    expect(() => dominantDownscale(solid(2, 2, RED), 1, 1, [])).toThrow(Error);
    expect(() => dominantDownscale(solid(2, 2, RED), 0, 1, [RED])).toThrow(RangeError);
  });

  test('원본 버퍼를 바꾸지 않는다', () => {
    const src = solid(4, 4, RED);
    const before = Array.from(src.data);
    dominantDownscale(src, 2, 2, [RED]);
    expect(Array.from(src.data)).toEqual(before);
  });
});
