export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const assertBrushSize = (size: number) => {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`붓 크기는 1 이상의 정수여야 해요: ${size}`);
  }
};

/**
 * 누른 칸(x, y)을 기준으로 한 N×N 붓의 왼쪽 위 칸. 이미지 밖으로 나가도 자르지 않은 값이다(커서 모양용).
 * 홀수는 누른 칸이 가운데, 짝수는 누른 칸이 가운데 네 칸 중 오른쪽 아래가 된다.
 */
export function brushOrigin(x: number, y: number, size: number): { left: number; top: number } {
  assertBrushSize(size);
  const offset = Math.floor(size / 2);
  return { left: x - offset, top: y - offset };
}

/** 붓이 실제로 칠하는 영역. 이미지 밖은 잘라내고, 완전히 밖이면 null. */
export function brushRect(x: number, y: number, size: number, width: number, height: number): Rect | null {
  const { left, top } = brushOrigin(x, y, size);
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(width, left + size);
  const y1 = Math.min(height, top + size);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
