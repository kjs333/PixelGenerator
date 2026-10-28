export type Rgb = [r: number, g: number, b: number];

/** 색상 h는 0~360도, 채도 s와 명도 v는 0~1 */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));
const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

/** "#rrggbb" → [r, g, b]. 형식이 맞지 않으면 null. */
export function hexToRgb(hex: string): Rgb | null {
  if (!HEX_COLOR.test(hex)) return null;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** RGB → 소문자 "#rrggbb". 범위를 벗어난 값은 0~255 정수로 맞춘다. */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`;
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sat = clampUnit(s);
  const val = clampUnit(v);
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - chroma;

  const [r, g, b] =
    hue < 60 ? [chroma, x, 0]
    : hue < 120 ? [x, chroma, 0]
    : hue < 180 ? [0, chroma, x]
    : hue < 240 ? [0, x, chroma]
    : hue < 300 ? [x, 0, chroma]
    : [chroma, 0, x];
  return [clampByte((r! + m) * 255), clampByte((g! + m) * 255), clampByte((b! + m) * 255)];
}
