// 압축하지 않는(STORE) zip 작성기. PNG는 이미 압축되어 있어 다시 압축해도 거의 줄지 않으므로
// 런타임 의존성 없이 직접 만든다. 파일 이름은 영문·숫자만 쓴다고 가정한다(UTF-8 플래그를 쓰지 않음).

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** zip이 파일마다 기록하는 CRC-32. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** zip에 쓰는 DOS 날짜·시각(2초 단위, 1980년부터). */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** 파일 목록을 zip 한 덩어리로 만든다. */
export function createZip(entries: ZipEntry[], date: Date = new Date()): Uint8Array {
  const { time, day } = dosDateTime(date);
  const encoder = new TextEncoder();
  const records = entries.map((entry) => ({
    ...entry,
    nameBytes: encoder.encode(entry.name),
    crc: crc32(entry.data),
  }));

  const localSize = records.reduce((sum, r) => sum + 30 + r.nameBytes.length + r.data.length, 0);
  const centralSize = records.reduce((sum, r) => sum + 46 + r.nameBytes.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (v: number) => {
    view.setUint16(at, v, true);
    at += 2;
  };
  const u32 = (v: number) => {
    view.setUint32(at, v, true);
    at += 4;
  };
  const bytes = (b: Uint8Array) => {
    out.set(b, at);
    at += b.length;
  };

  // 파일마다: 로컬 헤더 + 내용
  const offsets: number[] = [];
  for (const r of records) {
    offsets.push(at);
    u32(0x04034b50);
    u16(20); // 풀 때 필요한 버전 2.0
    u16(0); // 플래그
    u16(0); // 압축 안 함(STORE)
    u16(time);
    u16(day);
    u32(r.crc);
    u32(r.data.length); // 압축된 크기
    u32(r.data.length); // 원래 크기
    u16(r.nameBytes.length);
    u16(0); // 추가 필드 길이
    bytes(r.nameBytes);
    bytes(r.data);
  }

  // 중앙 디렉터리: 파일 목록
  const centralStart = at;
  records.forEach((r, i) => {
    u32(0x02014b50);
    u16(20); // 만든 버전
    u16(20); // 풀 때 필요한 버전
    u16(0);
    u16(0);
    u16(time);
    u16(day);
    u32(r.crc);
    u32(r.data.length);
    u32(r.data.length);
    u16(r.nameBytes.length);
    u16(0); // 추가 필드 길이
    u16(0); // 설명 길이
    u16(0); // 디스크 번호
    u16(0); // 내부 속성
    u32(0); // 외부 속성
    u32(offsets[i]!);
    bytes(r.nameBytes);
  });

  // 끝 레코드
  const centralLength = at - centralStart;
  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(records.length);
  u16(records.length);
  u32(centralLength);
  u32(centralStart);
  u16(0); // 설명 길이
  return out;
}
