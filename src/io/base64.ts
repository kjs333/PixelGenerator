const CHUNK = 0x8000; // String.fromCharCode 인자 개수 제한을 넘지 않도록 나눠서 바꾼다

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** base64 문자열을 바이트로 바꾼다. `data:image/png;base64,` 머리말이 붙어 있어도 된다. 형식이 틀리면 오류. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/^data:[^,]*,/, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG 머리(IHDR)에서 가로·세로를 읽는다. PNG가 아니면 null. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(12) !== 0x49484452) return null; // 'IHDR'
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
