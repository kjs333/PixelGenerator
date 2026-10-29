import { describe, expect, test } from 'vitest';
import { brushOrigin, brushRect } from '../../src/editor/brush';

describe('brushOrigin', () => {
  test('1×1은 누른 칸 자신이다', () => {
    expect(brushOrigin(5, 7, 1)).toEqual({ left: 5, top: 7 });
  });

  test('홀수 크기는 누른 칸을 가운데에 둔다', () => {
    expect(brushOrigin(5, 5, 3)).toEqual({ left: 4, top: 4 });
    expect(brushOrigin(5, 5, 5)).toEqual({ left: 3, top: 3 });
  });

  test('짝수 크기는 누른 칸이 오른쪽 아래 가운데 칸이 된다', () => {
    expect(brushOrigin(5, 5, 2)).toEqual({ left: 4, top: 4 });
    expect(brushOrigin(5, 5, 4)).toEqual({ left: 3, top: 3 });
  });
});

describe('brushRect', () => {
  test('1×1은 칸 하나다', () => {
    expect(brushRect(3, 4, 1, 10, 10)).toEqual({ x: 3, y: 4, w: 1, h: 1 });
  });

  test('N×N 정사각형 영역을 돌려준다', () => {
    expect(brushRect(5, 5, 2, 10, 10)).toEqual({ x: 4, y: 4, w: 2, h: 2 });
    expect(brushRect(5, 5, 3, 10, 10)).toEqual({ x: 4, y: 4, w: 3, h: 3 });
  });

  test('이미지 밖으로 나가는 부분은 잘라낸다', () => {
    expect(brushRect(0, 0, 3, 10, 10)).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(brushRect(9, 9, 3, 10, 10)).toEqual({ x: 8, y: 8, w: 2, h: 2 });
  });

  test('완전히 밖이면 null이다', () => {
    expect(brushRect(-10, 5, 3, 10, 10)).toBeNull();
    expect(brushRect(5, 50, 2, 10, 10)).toBeNull();
  });

  test('붓 크기가 1 미만이거나 정수가 아니면 오류를 낸다', () => {
    expect(() => brushRect(1, 1, 0, 10, 10)).toThrow(RangeError);
    expect(() => brushRect(1, 1, 2.5, 10, 10)).toThrow(RangeError);
  });
});
