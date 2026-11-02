import { describe, expect, test } from 'vitest';
import { crc32, createZip } from '../../src/io/zip';

/** 끝 레코드 → 중앙 디렉터리 → 로컬 헤더 순서로 읽어서 파일 이름과 내용을 꺼낸다. */
function readZip(zip: Uint8Array): { name: string; data: Uint8Array; crc: number }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralStart = view.getUint32(end + 16, true);
  expect(centralStart + centralSize).toBe(end); // 중앙 디렉터리 바로 뒤가 끝 레코드

  const files = [];
  let at = centralStart;
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));

    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint16(localOffset + 8, true)).toBe(0); // 압축 안 함
    const localNameLength = view.getUint16(localOffset + 26, true);
    const dataStart = localOffset + 30 + localNameLength;
    files.push({ name, crc, data: zip.subarray(dataStart, dataStart + size) });
    at += 46 + nameLength;
  }
  return files;
}

describe('crc32', () => {
  test('표준 검사 값과 같다', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('createZip', () => {
  test('넣은 파일을 순서대로, 내용 그대로 다시 읽을 수 있다', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);
    const files = readZip(
      createZip([
        { name: 'frame-01.png', data: a },
        { name: 'frame-02.png', data: b },
      ]),
    );
    expect(files.map((f) => f.name)).toEqual(['frame-01.png', 'frame-02.png']);
    expect(files[0]!.data).toEqual(a);
    expect(files[1]!.data).toEqual(b);
    expect(files.map((f) => f.crc)).toEqual([crc32(a), crc32(b)]);
  });

  test('빈 목록이면 끝 레코드만 있는 22바이트 zip', () => {
    const zip = createZip([]);
    expect(zip.length).toBe(22);
    expect(readZip(zip)).toEqual([]);
  });

  test('파일 날짜·시각을 DOS 형식으로 기록한다', () => {
    const zip = createZip(
      [{ name: 'a', data: new Uint8Array([0]) }],
      new Date(2026, 9, 30, 13, 45, 10),
    );
    const view = new DataView(zip.buffer);
    expect(view.getUint16(10, true)).toBe((13 << 11) | (45 << 5) | 5); // 시각(초는 2초 단위)
    expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 30); // 날짜
  });
});
