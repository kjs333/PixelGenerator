import { describe, expect, test } from 'vitest';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from '../../src/core/hsv';

describe('hexToRgb', () => {
  test('#rrggbb를 RGB 숫자로 바꾼다(대소문자 무관)', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0]);
    expect(hexToRgb('#12ABef')).toEqual([18, 171, 239]);
  });

  test.each(['red', '#fff', '#12345g', '#1234567', 'ff8800', ''])('%s 는 null이다', (value) => {
    expect(hexToRgb(value)).toBeNull();
  });
});

describe('rgbToHex', () => {
  test('두 자리로 맞춘 소문자 #rrggbb를 만든다', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 136, 0)).toBe('#ff8800');
    expect(rgbToHex(10, 11, 12)).toBe('#0a0b0c');
  });

  test('범위를 벗어나거나 소수인 값은 0~255 정수로 맞춘다', () => {
    expect(rgbToHex(-5, 300, 127.6)).toBe('#00ff80');
  });
});

describe('rgbToHsv / hsvToRgb', () => {
  test('기본 색의 색상·채도·명도 값이 맞다', () => {
    const red = rgbToHsv(255, 0, 0);
    expect(red.h).toBeCloseTo(0);
    expect(red.s).toBeCloseTo(1);
    expect(red.v).toBeCloseTo(1);
    expect(rgbToHsv(0, 255, 0).h).toBeCloseTo(120);
    expect(rgbToHsv(0, 0, 255).h).toBeCloseTo(240);
  });

  test('흰색·검정·회색은 채도가 0이다', () => {
    expect(rgbToHsv(255, 255, 255)).toMatchObject({ s: 0, v: 1 });
    expect(rgbToHsv(0, 0, 0)).toMatchObject({ s: 0, v: 0 });
    expect(rgbToHsv(128, 128, 128).s).toBe(0);
  });

  test('hsvToRgb가 기본 색을 돌려준다', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual([255, 0, 0]);
    expect(hsvToRgb(120, 1, 1)).toEqual([0, 255, 0]);
    expect(hsvToRgb(240, 1, 1)).toEqual([0, 0, 255]);
    expect(hsvToRgb(60, 1, 1)).toEqual([255, 255, 0]);
    expect(hsvToRgb(0, 0, 1)).toEqual([255, 255, 255]);
    expect(hsvToRgb(200, 0.5, 0)).toEqual([0, 0, 0]);
  });

  test('색상 360은 0과 같고, 음수나 360 초과도 한 바퀴로 맞춘다', () => {
    expect(hsvToRgb(360, 1, 1)).toEqual(hsvToRgb(0, 1, 1));
    expect(hsvToRgb(-120, 1, 1)).toEqual(hsvToRgb(240, 1, 1));
    expect(hsvToRgb(480, 1, 1)).toEqual(hsvToRgb(120, 1, 1));
  });

  test.each([
    [255, 136, 0],
    [12, 200, 99],
    [0, 0, 0],
    [255, 255, 255],
    [128, 128, 128],
    [1, 2, 3],
    [250, 250, 10],
    [18, 171, 239],
  ])('RGB(%i,%i,%i)는 HSV로 바꿨다 되돌려도 같은 값이다', (r, g, b) => {
    const { h, s, v } = rgbToHsv(r, g, b);
    expect(hsvToRgb(h, s, v)).toEqual([r, g, b]);
  });
});
