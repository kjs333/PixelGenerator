import { describe, expect, test } from 'vitest';
import { cloneBuffer, createBuffer, getPixel, hasTransparency, setPixel } from '../../src/core/buffer';

describe('buffer', () => {
  test('새 버퍼는 크기에 맞는 길이의 완전 투명 데이터를 가진다', () => {
    const buf = createBuffer(3, 2);
    expect(buf.width).toBe(3);
    expect(buf.height).toBe(2);
    expect(buf.data.length).toBe(3 * 2 * 4);
    expect(Array.from(buf.data).every((v) => v === 0)).toBe(true);
  });

  test('setPixel로 쓴 값을 getPixel로 같은 좌표에서 읽는다', () => {
    const buf = createBuffer(4, 4);
    setPixel(buf, 2, 3, [10, 20, 30, 255]);
    expect(getPixel(buf, 2, 3)).toEqual([10, 20, 30, 255]);
    expect(getPixel(buf, 1, 3)).toEqual([0, 0, 0, 0]);
  });

  test('cloneBuffer는 원본과 데이터를 공유하지 않는다', () => {
    const a = createBuffer(2, 2);
    const b = cloneBuffer(a);
    setPixel(b, 0, 0, [1, 2, 3, 4]);
    expect(getPixel(a, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  test('크기가 0 이하이거나 정수가 아니면 만들지 않는다', () => {
    expect(() => createBuffer(0, 5)).toThrow(RangeError);
    expect(() => createBuffer(5, -1)).toThrow(RangeError);
    expect(() => createBuffer(2.5, 2)).toThrow(RangeError);
  });

  test('범위 밖 좌표를 읽거나 쓰면 오류를 낸다', () => {
    const buf = createBuffer(2, 2);
    expect(() => getPixel(buf, 2, 0)).toThrow(RangeError);
    expect(() => setPixel(buf, 0, -1, [0, 0, 0, 0])).toThrow(RangeError);
  });
});

describe('hasTransparency', () => {
  test('모든 칸이 불투명하면 false', () => {
    const buf = createBuffer(2, 2);
    buf.data.fill(255);
    expect(hasTransparency(buf)).toBe(false);
  });

  test('완전 투명이나 반투명 칸이 하나라도 있으면 true', () => {
    const buf = createBuffer(2, 2);
    buf.data.fill(255);
    setPixel(buf, 1, 1, [10, 20, 30, 254]);
    expect(hasTransparency(buf)).toBe(true);
    expect(hasTransparency(createBuffer(1, 1))).toBe(true);
  });
});
