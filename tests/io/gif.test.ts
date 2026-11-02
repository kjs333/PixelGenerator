import { describe, expect, test } from 'vitest';
import type { PixelBuffer, RGBA } from '../../src/core/types';
import { encodeGif, gifDelay } from '../../src/io/gif';
import { fromPixels, solid } from '../helpers';

interface DecodedFrame {
  delay: number;
  disposal: number;
  transparent: number | null;
  indices: number[];
}

/** 표준 GIF LZW 풀기(인코더와 따로 쓴 것). */
function lzwDecode(data: number[], minCodeSize: number, pixelCount: number): number[] {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = Array.from({ length: end + 1 }, (_, i) => [i]);
    codeSize = minCodeSize + 1;
  };
  reset();
  const out: number[] = [];
  let pos = 0;
  const read = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++, pos++) {
      code |= ((data[pos >> 3]! >> (pos & 7)) & 1) << i;
    }
    return code;
  };
  let prev: number[] | null = null;
  while (pos + codeSize <= data.length * 8) {
    const code = read();
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === end) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code]!;
    else if (code === dict.length && prev) entry = [...prev, prev[0]!];
    else throw new Error(`잘못된 코드 ${code}`);
    out.push(...entry);
    if (prev && dict.length < 4096) dict.push([...prev, entry[0]!]);
    if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
    prev = entry;
  }
  expect(out.length).toBe(pixelCount);
  return out;
}

function decodeGif(gif: Uint8Array) {
  let at = 0;
  const byte = () => gif[at++]!;
  const word = () => byte() | (byte() << 8);
  const text = (n: number) => String.fromCharCode(...gif.slice(at, (at += n)));

  expect(text(6)).toBe('GIF89a');
  const width = word();
  const height = word();
  const packed = byte();
  at += 2;
  expect(packed & 0x80).toBe(0x80);
  const tableSize = 1 << ((packed & 7) + 1);
  const palette: RGBA[] = [];
  for (let i = 0; i < tableSize; i++) palette.push([byte(), byte(), byte(), 255]);

  let loops: number | null = null;
  const frames: DecodedFrame[] = [];
  let gce = { delay: 0, disposal: 0, transparent: null as number | null };
  const readBlocks = () => {
    const data: number[] = [];
    for (let n = byte(); n > 0; n = byte()) data.push(...gif.slice(at, (at += n)));
    return data;
  };
  for (;;) {
    const kind = byte();
    if (kind === 0x3b) break;
    if (kind === 0x21) {
      const label = byte();
      if (label === 0xf9) {
        byte();
        const flags = byte();
        const delay = word();
        const index = byte();
        byte();
        gce = { delay, disposal: (flags >> 2) & 7, transparent: flags & 1 ? index : null };
      } else if (label === 0xff) {
        byte();
        expect(text(11)).toBe('NETSCAPE2.0');
        const data = readBlocks();
        loops = data[1]! | (data[2]! << 8);
      } else readBlocks();
    } else if (kind === 0x2c) {
      at += 4;
      expect(word()).toBe(width);
      expect(word()).toBe(height);
      expect(byte()).toBe(0);
      const minCodeSize = byte();
      const indices = lzwDecode(readBlocks(), minCodeSize, width * height);
      frames.push({ ...gce, indices });
    } else throw new Error(`알 수 없는 블록 ${kind}`);
  }
  return { width, height, palette, loops, frames };
}

/** 풀어낸 프레임을 RGBA로 되돌린다. 투명 칸은 [0,0,0,0]. */
function toRgba(decoded: ReturnType<typeof decodeGif>, frame: DecodedFrame): RGBA[] {
  return frame.indices.map((i) => (i === frame.transparent ? [0, 0, 0, 0] : decoded.palette[i]!));
}

const pixelsOf = (buf: PixelBuffer): RGBA[] =>
  Array.from({ length: buf.width * buf.height }, (_, p) => {
    const d = buf.data.subarray(p * 4, p * 4 + 4);
    return d[3]! < 128 ? [0, 0, 0, 0] : [d[0]!, d[1]!, d[2]!, 255];
  });

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

describe('gifDelay', () => {
  test('FPS를 1/100초 단위로 바꾸고, 너무 짧으면 0.02초로 맞춘다', () => {
    expect(gifDelay(10)).toBe(10);
    expect(gifDelay(8)).toBe(13);
    expect(gifDelay(24)).toBe(4);
    expect(gifDelay(100)).toBe(2);
    expect(() => gifDelay(0)).toThrow(RangeError);
  });
});

describe('encodeGif', () => {
  test('크기, 무한 반복, 프레임 간격, 픽셀이 그대로 들어간다', () => {
    const a = fromPixels(2, 2, [RED, BLUE, BLUE, RED]);
    const b = fromPixels(2, 2, [BLUE, RED, RED, BLUE]);
    const decoded = decodeGif(encodeGif([a, b], 13));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.loops).toBe(0);
    expect(decoded.frames).toHaveLength(2);
    expect(decoded.frames.map((f) => f.delay)).toEqual([13, 13]);
    expect(decoded.frames[0]!.transparent).toBeNull();
    expect(toRgba(decoded, decoded.frames[0]!)).toEqual(pixelsOf(a));
    expect(toRgba(decoded, decoded.frames[1]!)).toEqual(pixelsOf(b));
  });

  test('투명 칸은 투명색 번호가 되고, 프레임마다 지운 뒤 다음 프레임을 그린다', () => {
    const a = fromPixels(2, 1, [RED, CLEAR]);
    const b = fromPixels(2, 1, [CLEAR, RED]);
    const decoded = decodeGif(encodeGif([a, b], 10));
    for (const frame of decoded.frames) {
      expect(frame.transparent).not.toBeNull();
      expect(frame.disposal).toBe(2);
    }
    expect(toRgba(decoded, decoded.frames[0]!)).toEqual([RED, CLEAR]);
    expect(toRgba(decoded, decoded.frames[1]!)).toEqual([CLEAR, RED]);
  });

  test('반투명은 알파 128을 기준으로 투명·불투명이 된다', () => {
    const img = fromPixels(2, 1, [
      [10, 20, 30, 127],
      [10, 20, 30, 128],
    ]);
    const decoded = decodeGif(encodeGif([img], 10));
    expect(toRgba(decoded, decoded.frames[0]!)).toEqual([CLEAR, [10, 20, 30, 255]]);
  });

  test('표가 가득 차서 처음부터 다시 쌓는 긴 그림도 그대로 풀린다', () => {
    // 색이 불규칙해서 LZW 표가 4096칸을 여러 번 넘는다
    const pixels: RGBA[] = [];
    let seed = 7;
    for (let i = 0; i < 128 * 128; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = seed % 200;
      pixels.push(v < 10 ? CLEAR : [v, (v * 3) % 256, (v * 7) % 256, 255]);
    }
    const img = fromPixels(128, 128, pixels);
    const decoded = decodeGif(encodeGif([img], 10));
    expect(toRgba(decoded, decoded.frames[0]!)).toEqual(pixelsOf(img));
  });

  test('256색이 넘으면 팔레트를 줄이고, 모든 칸이 팔레트 안의 색이 된다', () => {
    const pixels: RGBA[] = [];
    for (let i = 0; i < 600; i++) pixels.push([i % 256, Math.floor(i / 256) * 100, 50, 255]);
    const decoded = decodeGif(encodeGif([fromPixels(600, 1, pixels)], 10));
    expect(decoded.palette).toHaveLength(256);
    expect(decoded.frames[0]!.transparent).toBeNull();
    expect(Math.max(...decoded.frames[0]!.indices)).toBeLessThan(256);
  });

  test('한 색짜리 그림도 만든다', () => {
    const decoded = decodeGif(encodeGif([solid(3, 3, BLUE)], 10));
    expect(toRgba(decoded, decoded.frames[0]!)).toEqual(Array(9).fill(BLUE));
  });

  test('프레임이 없거나 크기가 다르면 오류를 낸다', () => {
    expect(() => encodeGif([], 10)).toThrow(RangeError);
    expect(() => encodeGif([solid(2, 2, RED), solid(3, 2, RED)], 10)).toThrow(RangeError);
  });
});
