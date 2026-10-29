import { describe, expect, test } from 'vitest';
import { linePoints } from '../../src/editor/line';

describe('linePoints', () => {
  test('같은 칸이면 그 칸 하나만 돌려준다', () => {
    expect(linePoints(3, 3, 3, 3)).toEqual([{ x: 3, y: 3 }]);
  });

  test('가로 직선은 끝 칸까지 모두 포함한다', () => {
    expect(linePoints(0, 2, 3, 2)).toEqual([
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
  });

  test('세로 직선은 끝 칸까지 모두 포함한다', () => {
    expect(linePoints(1, 0, 1, 2)).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);
  });

  test('대각선도 빠진 칸 없이 이어진다', () => {
    expect(linePoints(0, 0, 3, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  test('시작과 끝이 바뀌어도(반대 방향) 같은 칸들을 지난다', () => {
    const forward = linePoints(0, 0, 5, 2).map((p) => `${p.x},${p.y}`).sort();
    const backward = linePoints(5, 2, 0, 0).map((p) => `${p.x},${p.y}`).sort();
    expect(backward).toEqual(forward);
  });

  test.each([
    [0, 0, 7, 3],
    [10, 2, 1, 9],
    [4, 4, 4, 0],
    [0, 5, 12, 5],
  ])('(%i,%i)→(%i,%i): 시작과 끝을 포함하고 이웃한 칸끼리 한 칸 이내로 이어진다', (x0, y0, x1, y1) => {
    const points = linePoints(x0, y0, x1, y1);
    expect(points[0]).toEqual({ x: x0, y: y0 });
    expect(points[points.length - 1]).toEqual({ x: x1, y: y1 });
    expect(points.length).toBe(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1);
    for (let i = 1; i < points.length; i++) {
      expect(Math.abs(points[i]!.x - points[i - 1]!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(points[i]!.y - points[i - 1]!.y)).toBeLessThanOrEqual(1);
    }
  });

  test('정수가 아닌 좌표는 오류를 낸다', () => {
    expect(() => linePoints(0.5, 0, 3, 3)).toThrow(RangeError);
  });
});
