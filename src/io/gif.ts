// 애니메이션 GIF(GIF89a) 작성기. 프레임 전체가 팔레트 하나를 같이 쓰고, 무한 반복한다.
// GIF는 한 장에 256색까지, 투명은 켜고 끄기만 된다. 알파 128 미만은 투명, 그 이상은 불투명으로 본다.
import { quantize } from '../core/quantize';
import type { PixelBuffer, RGBA } from '../core/types';

const ALPHA_OPAQUE_MIN = 128;
const MAX_CODES = 4096; // LZW 코드는 12비트까지
const MIN_DELAY_CS = 2; // 브라우저는 0.02초보다 짧은 간격을 0.1초로 바꿔 버린다

/** FPS를 GIF 프레임 간격(1/100초 단위)으로 바꾼다. */
export function gifDelay(fps: number): number {
  if (!(fps > 0)) throw new RangeError(`FPS는 0보다 커야 해요: ${fps}`);
  return Math.max(MIN_DELAY_CS, Math.round(100 / fps));
}

interface IndexedFrames {
  palette: RGBA[];
  /** 투명 칸에 쓰는 색 번호. 투명 칸이 없으면 null. */
  transparent: number | null;
  frames: Uint8Array[];
}

/** 모든 프레임을 팔레트 하나의 색 번호로 바꾼다. 색이 너무 많으면 가장 가까운 색으로 맞춘다. */
function indexFrames(frames: PixelBuffer[]): IndexedFrames {
  const colors = new Set<number>();
  let hasTransparent = false;
  for (const frame of frames) {
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! < ALPHA_OPAQUE_MIN) hasTransparent = true;
      else colors.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    }
  }

  const limit = hasTransparent ? 255 : 256; // 투명에 한 칸을 남긴다
  let palette: RGBA[];
  if (colors.size <= limit) {
    palette = [...colors].map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255] as const);
  } else {
    // 프레임을 세로로 이어 붙인 한 장에서 팔레트를 뽑는다
    const { width } = frames[0]!;
    const all = new Uint8ClampedArray(frames.reduce((n, f) => n + f.data.length, 0));
    let at = 0;
    for (const frame of frames) {
      all.set(frame.data, at);
      at += frame.data.length;
    }
    palette = quantize({ width, height: all.length / 4 / width, data: all }, limit);
  }
  const transparent = hasTransparent ? palette.length : null;

  const lookup = new Map<number, number>();
  palette.forEach(([r, g, b], i) => lookup.set((r << 16) | (g << 8) | b, i));
  const nearest = (key: number): number => {
    let index = lookup.get(key);
    if (index !== undefined) return index;
    const r = (key >> 16) & 255;
    const g = (key >> 8) & 255;
    const b = key & 255;
    let best = Infinity;
    index = 0;
    palette.forEach(([pr, pg, pb], i) => {
      const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
      if (d < best) {
        best = d;
        index = i;
      }
    });
    lookup.set(key, index);
    return index;
  };

  const indexed = frames.map((frame) => {
    const d = frame.data;
    const out = new Uint8Array(frame.width * frame.height);
    for (let p = 0, i = 0; p < out.length; p++, i += 4) {
      out[p] =
        d[i + 3]! < ALPHA_OPAQUE_MIN
          ? transparent!
          : nearest((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    }
    return out;
  });
  return { palette, transparent, frames: indexed };
}

/** 바이트를 차례로 모은다. */
class ByteWriter {
  private bytes: number[] = [];
  byte(...values: number[]) {
    this.bytes.push(...values);
  }
  word(value: number) {
    this.bytes.push(value & 255, (value >> 8) & 255);
  }
  text(value: string) {
    for (const ch of value) this.bytes.push(ch.charCodeAt(0));
  }
  toArray(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** 색 번호를 GIF식 LZW로 압축해서 255바이트 이하 묶음들로 쓴다. */
function writeLzw(out: ByteWriter, indices: Uint8Array, minCodeSize: number): void {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const block: number[] = [];
  let bits = 0;
  let bitCount = 0;
  const emit = (code: number, size: number) => {
    bits |= code << bitCount; // 낮은 비트부터 채운다
    bitCount += size;
    while (bitCount >= 8) {
      block.push(bits & 255);
      bits >>>= 8;
      bitCount -= 8;
      if (block.length === 255) {
        out.byte(255, ...block);
        block.length = 0;
      }
    }
  };

  let codeSize = minCodeSize + 1;
  let next = end + 1;
  let table = new Map<number, number>();
  emit(clear, codeSize);

  let current = indices[0]!;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]!;
    const key = (current << 8) | k;
    const found = table.get(key);
    if (found !== undefined) {
      current = found;
      continue;
    }
    emit(current, codeSize);
    if (next === MAX_CODES) {
      // 표가 가득 차면 처음부터 다시 쌓는다
      emit(clear, codeSize);
      codeSize = minCodeSize + 1;
      next = end + 1;
      table = new Map();
    } else {
      if (next >= 1 << codeSize) codeSize++;
      table.set(key, next++);
    }
    current = k;
  }
  emit(current, codeSize);
  emit(end, codeSize);
  if (bitCount > 0) emit(0, 8 - bitCount);
  if (block.length > 0) out.byte(block.length, ...block);
  out.byte(0); // 데이터 끝
}

/**
 * 프레임들을 무한 반복하는 애니메이션 GIF 한 덩어리로 만든다. 프레임 크기는 모두 같아야 한다.
 * delay는 프레임 간격(1/100초 단위)이다.
 */
export function encodeGif(frames: PixelBuffer[], delay: number): Uint8Array {
  if (frames.length === 0) throw new RangeError('프레임이 없어요');
  const { width, height } = frames[0]!;
  if (frames.some((f) => f.width !== width || f.height !== height)) {
    throw new RangeError('프레임 크기가 모두 같아야 해요');
  }

  const { palette, transparent, frames: indexed } = indexFrames(frames);
  const used = palette.length + (transparent === null ? 0 : 1);
  let tableBits = 1;
  while (1 << tableBits < used) tableBits++;
  const minCodeSize = Math.max(2, tableBits);

  const out = new ByteWriter();
  out.text('GIF89a');
  out.word(width);
  out.word(height);
  out.byte(0xf0 | (tableBits - 1), 0, 0); // 전체 색표 있음, 배경색 0번, 화면비 없음
  for (let i = 0; i < 1 << tableBits; i++) {
    const [r, g, b] = palette[i] ?? [0, 0, 0];
    out.byte(r, g, b);
  }
  // 무한 반복(NETSCAPE2.0 확장, 반복 횟수 0)
  out.byte(0x21, 0xff, 11);
  out.text('NETSCAPE2.0');
  out.byte(3, 1, 0, 0, 0);

  // 투명 칸이 있으면 다음 프레임 전에 지워야 앞 프레임이 비쳐 보이지 않는다
  const disposal = transparent === null ? 1 : 2;
  for (const frame of indexed) {
    out.byte(0x21, 0xf9, 4, (disposal << 2) | (transparent === null ? 0 : 1));
    out.word(delay);
    out.byte(transparent ?? 0, 0);
    out.byte(0x2c);
    out.word(0);
    out.word(0);
    out.word(width);
    out.word(height);
    out.byte(0); // 지역 색표 없음, 비월 없음
    out.byte(minCodeSize);
    writeLzw(out, frame, minCodeSize);
  }
  out.byte(0x3b);
  return out.toArray();
}
