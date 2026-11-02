import { createBuffer } from './buffer';
import type { PixelBuffer } from './types';

export interface SheetLayout {
  columns: number;
  rows: number;
  /** 시트 PNG 전체 크기(칸 사이 여백 없음) */
  width: number;
  height: number;
}

/** 같은 크기 프레임 count개를 한 줄에 최대 columns개씩 놓았을 때의 배치. */
export function sheetLayout(
  frameWidth: number,
  frameHeight: number,
  count: number,
  columns: number,
): SheetLayout {
  if (count < 1) return { columns: 0, rows: 0, width: 0, height: 0 };
  const cols = Math.min(columns, count);
  const rows = Math.ceil(count / cols);
  return { columns: cols, rows, width: frameWidth * cols, height: frameHeight * rows };
}

/**
 * 프레임을 왼쪽 위부터 가로 방향으로 한 줄에 columns개씩, 칸 사이 여백 없이 붙인다.
 * 마지막 줄의 빈 칸은 투명이다. 모든 프레임은 크기가 같아야 한다.
 */
export function buildSheet(frames: PixelBuffer[], columns: number): PixelBuffer {
  const first = frames[0];
  if (!first) throw new RangeError('프레임이 없어요');
  if (frames.some((f) => f.width !== first.width || f.height !== first.height)) {
    throw new RangeError('프레임 크기가 모두 같아야 해요');
  }
  const layout = sheetLayout(first.width, first.height, frames.length, columns);
  const sheet = createBuffer(layout.width, layout.height);
  const rowBytes = first.width * 4;
  frames.forEach((frame, i) => {
    const left = (i % layout.columns) * first.width;
    const top = Math.floor(i / layout.columns) * first.height;
    for (let y = 0; y < first.height; y++) {
      const from = y * rowBytes;
      sheet.data.set(
        frame.data.subarray(from, from + rowBytes),
        ((top + y) * layout.width + left) * 4,
      );
    }
  });
  return sheet;
}
