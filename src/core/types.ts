/** 브라우저의 ImageData와 같은 모양의 평범한 객체. Node(테스트)에서도 쓸 수 있다. */
export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, 길이 = width * height * 4
}

export type RGBA = readonly [r: number, g: number, b: number, a: number];

export type DitherMode = 'none' | 'bayer' | 'floyd-steinberg';

export interface ConvertOptions {
  width: number;
  height: number;
  colors: number;
  dither: DitherMode;
  /** 주변과 색이 모두 다른 외톨이 칸을 주변 색으로 정리한다(디더링 없음일 때만 적용) */
  cleanup: boolean;
}
