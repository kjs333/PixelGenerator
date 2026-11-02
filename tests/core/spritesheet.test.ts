import { describe, expect, test } from 'vitest';
import { getPixel } from '../../src/core/buffer';
import { buildSheet, sheetColumns, sheetLayout } from '../../src/core/spritesheet';
import { solid } from '../helpers';

describe('sheetColumns', () => {
  test('Pixellab 시트처럼 정사각형에 가깝게 놓는다(원본 포함 장수 기준)', () => {
    expect(sheetLayout(32, 32, 5, sheetColumns(5))).toMatchObject({ columns: 3, rows: 2 }); // 4프레임 요청
    expect(sheetLayout(32, 32, 9, sheetColumns(9))).toMatchObject({ columns: 3, rows: 3 }); // 8프레임 요청
    expect(sheetLayout(32, 32, 17, sheetColumns(17))).toMatchObject({ columns: 5, rows: 4 }); // 16프레임 요청
  });

  test('장수에 따른 열 수', () => {
    expect([1, 2, 4, 5, 9, 10, 16, 17].map(sheetColumns)).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
    expect(sheetColumns(0)).toBe(0);
  });
});

describe('sheetLayout', () => {
  test('8프레임을 4열로 놓으면 4×2, 칸 사이 여백 없음', () => {
    expect(sheetLayout(32, 32, 8, 4)).toEqual({ columns: 4, rows: 2, width: 128, height: 64 });
  });

  test('열 수보다 프레임이 적으면 한 줄에 프레임 수만큼만 놓는다', () => {
    expect(sheetLayout(16, 24, 3, 4)).toEqual({ columns: 3, rows: 1, width: 48, height: 24 });
  });

  test('나누어떨어지지 않으면 마지막 줄이 하나 더 생긴다', () => {
    expect(sheetLayout(10, 10, 5, 4)).toEqual({ columns: 4, rows: 2, width: 40, height: 20 });
  });

  test('프레임이 없으면 크기 0', () => {
    expect(sheetLayout(32, 32, 0, 4)).toEqual({ columns: 0, rows: 0, width: 0, height: 0 });
  });
});

describe('buildSheet', () => {
  const red = [255, 0, 0, 255] as const;
  const green = [0, 255, 0, 255] as const;
  const blue = [0, 0, 255, 255] as const;

  test('프레임을 가로 방향으로 붙이고, 넘치면 다음 줄에 놓는다', () => {
    const sheet = buildSheet([solid(2, 2, red), solid(2, 2, green), solid(2, 2, blue)], 2);
    expect([sheet.width, sheet.height]).toEqual([4, 4]);
    expect(getPixel(sheet, 0, 0)).toEqual(red);
    expect(getPixel(sheet, 3, 1)).toEqual(green);
    expect(getPixel(sheet, 1, 3)).toEqual(blue);
  });

  test('마지막 줄의 빈 칸은 투명이다', () => {
    const sheet = buildSheet([solid(2, 2, red), solid(2, 2, green), solid(2, 2, blue)], 2);
    expect(getPixel(sheet, 3, 3)).toEqual([0, 0, 0, 0]);
  });

  test('칸 사이 여백 없이 프레임 경계가 바로 붙는다', () => {
    const sheet = buildSheet([solid(3, 1, red), solid(3, 1, green)], 4);
    expect([sheet.width, sheet.height]).toEqual([6, 1]);
    expect(getPixel(sheet, 2, 0)).toEqual(red);
    expect(getPixel(sheet, 3, 0)).toEqual(green);
  });

  test('프레임이 없거나 크기가 다르면 오류를 낸다', () => {
    expect(() => buildSheet([], 4)).toThrow(RangeError);
    expect(() => buildSheet([solid(2, 2, red), solid(3, 2, red)], 4)).toThrow(RangeError);
  });
});
