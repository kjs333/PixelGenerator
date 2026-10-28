export interface ContainRect {
  /** 결과 이미지 안에서 내용이 들어가는 영역: 왼쪽 위 좌표와 크기(모두 정수 픽셀) */
  ox: number;
  oy: number;
  cw: number;
  ch: number;
}

/**
 * 원본 전체를 자르지 않고 목표 크기(width×height) 안에 비율을 지켜 가장 크게 넣고, 가운데에 놓는다.
 * 남는 부분은 여백이다(호출한 쪽에서 투명으로 둔다).
 */
export function fitContain(srcW: number, srcH: number, width: number, height: number): ContainRect {
  const scale = Math.min(width / srcW, height / srcH);
  const cw = Math.min(width, Math.max(1, Math.round(srcW * scale)));
  const ch = Math.min(height, Math.max(1, Math.round(srcH * scale)));
  return { ox: Math.floor((width - cw) / 2), oy: Math.floor((height - ch) / 2), cw, ch };
}
