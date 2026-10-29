/**
 * 두 칸 사이를 빠짐없이 잇는 칸 목록(Bresenham). 시작과 끝 칸을 모두 포함한다.
 * 마우스를 빠르게 움직여 포인터 이벤트가 듬성듬성 와도 칠한 칸이 끊기지 않게 하려는 것.
 */
export function linePoints(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  if (![x0, y0, x1, y1].every(Number.isInteger)) {
    throw new RangeError('칸 좌표는 정수여야 해요');
  }
  const points: { x: number; y: number }[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;

  for (;;) {
    points.push({ x, y });
    if (x === x1 && y === y1) return points;
    const doubled = err * 2;
    if (doubled > -dy) {
      err -= dy;
      x += stepX;
    }
    if (doubled < dx) {
      err += dx;
      y += stepY;
    }
  }
}
